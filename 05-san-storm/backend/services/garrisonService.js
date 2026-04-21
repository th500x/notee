/**
 * 驻守服务 - 驻守配置 CRUD、城市防守者查询
 *
 * 防守单位构建（属性加成计算、buildDefenseUnits 等）已提取至 garrisonBuildService.js。
 * 此文件保持对外公开 API 不变，仍从 garrisonBuildService 再导出这些函数。
 *
 * @module backend/services/garrisonService
 */

const { pool } = require('../database/connection');
const garrisonBuildService = require('./garrisonBuildService');

// 驻守槽位中所有卡牌字段
const CARD_FIELDS = [
  'char1_card', 'char1_equipment_card', 'char1_title', 'char1_achievement', 'char1_treasure', 'char1_troop1', 'char1_troop2',
  'char2_card', 'char2_equipment_card', 'char2_title', 'char2_achievement', 'char2_treasure', 'char2_troop1', 'char2_troop2',
];

const GARRISON_TROOP_FIELDS = ['char1_troop1', 'char1_troop2', 'char2_troop1', 'char2_troop2'];

/** 驻地槽「计入守军、可出战」的编队总兵力下限（与开战上阵总兵力规则独立；披挂≥800） */
const MIN_GARRISON_TOTAL_TROOPS = 800;

/** 开战 / 攻城等：上阵编组（is_equipped 部队）总兵力下限，全战斗通用 */
const MIN_MAIN_LINEUP_TROOPS_BATTLE = 200;

/** 玩家最多在几座城池出现「至少一张卡写入驻地槽」；与产品文档 13-2 一致 */
const MAX_GARRISON_CONFIGURED_CITIES = 5;

// 单部队参战最低兵力（兵力为0不参战；槽位总兵力见 MIN_GARRISON_TOTAL_TROOPS）
const MIN_TROOPS_TO_DEFEND = 1;

/**
 * 驻守槽内若干部队实例的当前总兵力（与战斗构建一致：current_troops 缺省则用满编上限）
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} conn
 * @param {string} playerId
 * @param {string[]} instanceIds
 */
async function sumTroopInstancesTotalTroops(conn, playerId, instanceIds) {
  const ids = [...new Set(instanceIds)].filter(Boolean);
  if (ids.length === 0) return 0;
  const ph = ids.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(
        COALESCE(pc.current_troops, COALESCE(ct.max_troops, 0) + COALESCE(pc.bonus_max_troops, 0))
      ), 0) AS total
     FROM player_cards pc
     LEFT JOIN config_troops ct ON pc.card_id = ct.troop_id
     WHERE pc.player_id = ? AND pc.instance_id IN (${ph})`,
    [playerId, ...ids]
  );
  return Number(rows[0]?.total) || 0;
}

/**
 * 上阵编组内所有已装备部队卡的当前总兵力（主公槽 + 将领1/2 共五槽可能存在的部队）
 */
async function sumMainLineupEquippedTroopTroops(conn, playerId) {
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(
        COALESCE(pc.current_troops, COALESCE(ct.max_troops, 0) + COALESCE(pc.bonus_max_troops, 0))
      ), 0) AS total
     FROM player_cards pc
     LEFT JOIN config_troops ct ON pc.card_id = ct.troop_id
     WHERE pc.player_id = ? AND pc.card_type = 'troop' AND pc.is_equipped = TRUE`,
    [playerId]
  );
  return Number(rows[0]?.total) || 0;
}

/**
 * 已装备部队出征粮草需求（与前端 `getMainLineupBattleFoodDeployCost` 一致）：每支 ceil(当前兵力/20) 求和。
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} conn
 * @param {string} playerId
 */
async function sumMainLineupBattleFoodDeployCost(conn, playerId) {
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(
        CEIL(GREATEST(0, COALESCE(pc.current_troops, COALESCE(ct.max_troops, 0) + COALESCE(pc.bonus_max_troops, 0))) / 20)
      ), 0) AS total
     FROM player_cards pc
     LEFT JOIN config_troops ct ON pc.card_id = ct.troop_id
     WHERE pc.player_id = ? AND pc.card_type = 'troop' AND pc.is_equipped = TRUE`,
    [playerId]
  );
  return Number(rows[0]?.total) || 0;
}

/**
 * 道路遭遇等：在已有事务连接上校验「上阵总兵力 + 出征粮草」（与攻城/野战入口一致）。
 * @param {import('mysql2').PoolConnection} conn
 * @param {string} playerId
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
async function validateMainLineupBattleGateOnConn(conn, playerId) {
  const troops = await sumMainLineupEquippedTroopTroops(conn, playerId);
  if (troops < MIN_MAIN_LINEUP_TROOPS_BATTLE) {
    return {
      ok: false,
      error: `上阵编组总兵力需≥${MIN_MAIN_LINEUP_TROOPS_BATTLE}（当前 ${troops}）`,
    };
  }
  const [pRows] = await conn.query('SELECT food FROM players WHERE player_id = ? FOR UPDATE', [playerId]);
  const food = Number(pRows[0]?.food) || 0;
  const need = await sumMainLineupBattleFoodDeployCost(conn, playerId);
  if (food < need) {
    return { ok: false, error: `出征需粮草 ${need}（当前 ${food}），粮草不足` };
  }
  return { ok: true };
}

/** 将本次 POST 与库中已有驻守行合并，避免请求体漏键导致将领2 部队未纳入总兵力 */
function mergeGarrisonPayloadWithPrevRow(prevSlot, incoming) {
  if (!prevSlot) return { ...incoming };
  const merged = { ...incoming };
  for (const f of CARD_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(incoming, f)) {
      merged[f] = prevSlot[f] ?? null;
    }
  }
  if (!Object.prototype.hasOwnProperty.call(incoming, 'cityId')) {
    merged.cityId = prevSlot.city_id ?? null;
  }
  if (!Object.prototype.hasOwnProperty.call(incoming, 'cityName')) {
    merged.cityName = prevSlot.city_name ?? null;
  }
  return merged;
}

// ── 从 garrisonBuildService 解构，供本模块内部（saveGarrison 等）使用 ──

async function getPlayerGarrisons(playerId) {
  const [rows] = await pool.query(
    'SELECT * FROM player_garrison WHERE player_id = ? ORDER BY city_id, garrison_slot',
    [playerId]
  );
  return rows;
}

/**
 * 某玩家在某城的驻地槽位行（卡池 A/B）
 * @param {string} playerId
 * @param {string} cityId
 */
async function getPlayerGarrisonsForCity(playerId, cityId) {
  if (!cityId) return [];
  const [rows] = await pool.query(
    'SELECT * FROM player_garrison WHERE player_id = ? AND city_id = ? ORDER BY garrison_slot',
    [playerId, cityId]
  );
  return rows;
}

/**
 * 鑾峰彇鐜╁鏌愪釜妲戒綅鐨勯┗瀹堥厤缃? */
async function getGarrisonSlot(playerId, cityId, slotNumber) {
  if (!cityId) return null;
  const [rows] = await pool.query(
    'SELECT * FROM player_garrison WHERE player_id = ? AND city_id = ? AND garrison_slot = ?',
    [playerId, cityId, slotNumber]
  );
  return rows[0] || null;
}

/**
 * Distinct city_id where this player has at least one non-null garrison card field (any slot).
 * @param {string} playerId
 * @returns {Promise<Set<string>>}
 */
async function getPlayerGarrisonConfiguredCityIds(playerId) {
  const conditions = CARD_FIELDS.map((f) => `g.${f} IS NOT NULL`).join(' OR ');
  const [rows] = await pool.query(
    `SELECT DISTINCT g.city_id AS city_id
     FROM player_garrison g
     WHERE g.player_id = ? AND (${conditions})`,
    [playerId]
  );
  return new Set((rows || []).map((r) => r.city_id).filter(Boolean));
}

/**
 * 淇濆瓨椹诲畧閰嶇疆锛圛NSERT ON DUPLICATE KEY UPDATE锛? */
async function saveGarrison(playerId, slotNumber, config) {
  const incomingCity = config && config.cityId;
  if (!incomingCity || String(incomingCity).trim() === '') {
    return { success: false, error: '缺少 cityId，无法按城池保存驻地编组' };
  }
  const prevSlot = await getGarrisonSlot(playerId, incomingCity, slotNumber);
  const mergedWithPrev = mergeGarrisonPayloadWithPrevRow(prevSlot, config);

  const configuredCityIds = await getPlayerGarrisonConfiguredCityIds(playerId);
  const targetCityId = String(mergedWithPrev.cityId || '').trim();
  if (!targetCityId) {
    return { success: false, error: '缺少 cityId，无法按城池保存驻地编组' };
  }
  if (!configuredCityIds.has(targetCityId) && configuredCityIds.size >= MAX_GARRISON_CONFIGURED_CITIES) {
    return {
      success: false,
      error: '已达驻地编组城池上限（5座）。请先在其它城池清空驻地编组，再在本城编组。',
    };
  }

  const instanceIds = CARD_FIELDS.map(f => mergedWithPrev[f]).filter(Boolean);

  // 检查卡牌是否已被其他驻守槽位占用
  if (instanceIds.length > 0) {
    const placeholders = instanceIds.map(() => '?').join(',');
    const [conflicts] = await pool.query(
      `SELECT g.garrison_slot, g.city_id, pc.instance_id
       FROM player_garrison g
       JOIN player_cards pc ON pc.instance_id IN (${placeholders})
       WHERE g.player_id = ? AND g.is_active = TRUE
         AND NOT (g.city_id <=> ? AND g.garrison_slot = ?)
         AND (${CARD_FIELDS.map(f => `g.${f} = pc.instance_id`).join(' OR ')})`,
      [...instanceIds, playerId, mergedWithPrev.cityId, slotNumber]
    );
    if (conflicts.length > 0) {
      return {
        success: false,
        error: '卡牌已被其他城池或卡池的驻地编组占用',
      };
    }

    // 妫€鏌ュ崱鐗屾槸鍚﹀凡琚笂闃电紪缁勫崰鐢紙is_equipped = TRUE 鐨勫崱鐗屼笉鑳界敤浜庨┗瀹堬級
    const [equippedConflicts] = await pool.query(
      `SELECT instance_id FROM player_cards
       WHERE instance_id IN (${placeholders}) AND player_id = ? AND is_equipped = TRUE`,
      [...instanceIds, playerId]
    );
    if (equippedConflicts.length > 0) {
      return { success: false, error: '部分卡牌已在上阵编组中，请先卸下再配置驻守' };
    }
  }

  const garrisonTroopFields = GARRISON_TROOP_FIELDS;
  const newlyAssignedTroopIds = [...new Set(
    garrisonTroopFields
      .map((f) => {
        const nextId = mergedWithPrev[f] || null;
        const prevId = prevSlot?.[f] || null;
        return nextId && nextId !== prevId ? nextId : null;
      })
      .filter(Boolean)
  )];
  if (newlyAssignedTroopIds.length > 0) {
    const ph = newlyAssignedTroopIds.map(() => '?').join(',');
    const [exhaustedCore] = await pool.query(
      `SELECT instance_id FROM player_cards
       WHERE player_id = ? AND instance_id IN (${ph})
         AND card_type = 'troop' AND rarity = 'core'
         AND max_battle_count IS NOT NULL
         AND battle_count >= max_battle_count`,
      [playerId, ...newlyAssignedTroopIds]
    );
    if (exhaustedCore.length > 0) {
      return {
        success: false,
        error: '核心(稀)部队耐久已耗尽，无法用于驻守，仅作纪念与下赛继承',
      };
    }
  }

  const hasChar = !!(mergedWithPrev.char1_card || mergedWithPrev.char2_card);
  const hasTroop = !!(mergedWithPrev.char1_troop1 || mergedWithPrev.char1_troop2 || mergedWithPrev.char2_troop1 || mergedWithPrev.char2_troop2);
  const troopInstanceIds = GARRISON_TROOP_FIELDS.map((f) => mergedWithPrev[f]).filter(Boolean);
  const totalTroopsConfigured = hasTroop
    ? await sumTroopInstancesTotalTroops(pool, playerId, troopInstanceIds)
    : 0;
  const isActive = hasChar && hasTroop && totalTroopsConfigured >= MIN_GARRISON_TOTAL_TROOPS;
  const belowTroopThreshold = hasChar && hasTroop && totalTroopsConfigured < MIN_GARRISON_TOTAL_TROOPS;

  await pool.query(
    `INSERT INTO player_garrison (
      player_id, garrison_slot, city_id, city_name,
      char1_card, char1_equipment_card, char1_title, char1_achievement, char1_treasure, char1_troop1, char1_troop2,
      char2_card, char2_equipment_card, char2_title, char2_achievement, char2_treasure, char2_troop1, char2_troop2,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      city_id = VALUES(city_id), city_name = VALUES(city_name),
      char1_card = VALUES(char1_card), char1_equipment_card = VALUES(char1_equipment_card),
      char1_title = VALUES(char1_title), char1_achievement = VALUES(char1_achievement),
      char1_treasure = VALUES(char1_treasure), char1_troop1 = VALUES(char1_troop1), char1_troop2 = VALUES(char1_troop2),
      char2_card = VALUES(char2_card), char2_equipment_card = VALUES(char2_equipment_card),
      char2_title = VALUES(char2_title), char2_achievement = VALUES(char2_achievement),
      char2_treasure = VALUES(char2_treasure), char2_troop1 = VALUES(char2_troop1), char2_troop2 = VALUES(char2_troop2),
      is_active = VALUES(is_active)`,
    [
      playerId, slotNumber, mergedWithPrev.cityId || null, mergedWithPrev.cityName || null,
      mergedWithPrev.char1_card || null, mergedWithPrev.char1_equipment_card || null,
      mergedWithPrev.char1_title || null, mergedWithPrev.char1_achievement || null, mergedWithPrev.char1_treasure || null,
      mergedWithPrev.char1_troop1 || null, mergedWithPrev.char1_troop2 || null,
      mergedWithPrev.char2_card || null, mergedWithPrev.char2_equipment_card || null,
      mergedWithPrev.char2_title || null, mergedWithPrev.char2_achievement || null, mergedWithPrev.char2_treasure || null,
      mergedWithPrev.char2_troop1 || null, mergedWithPrev.char2_troop2 || null,
      isActive,
    ]
  );

  // 鈹€鈹€ 閲嶇畻椹诲畧閮ㄩ槦鍗＄殑鐗规晥鍔犳垚锛堝鐢ㄤ笂闃电紪缁勭殑 applyCardBonusToTroops 閫昏緫锛?鈹€鈹€
  // 瀵?char1 鍜?char2 鍚勮嚜锛氬厛娓呴浂閮ㄩ槦鍗?bonus锛屽啀绱姞鎵€鏈夌壒鏁堝崱鐨?special_effect
  for (const charKey of ['char1', 'char2']) {
    const troopIds = [mergedWithPrev[`${charKey}_troop1`], mergedWithPrev[`${charKey}_troop2`]].filter(Boolean);
    if (troopIds.length === 0) continue;

    // 1. 娓呴浂璇ョ粍閮ㄩ槦鍗＄殑 bonus
    const ph = troopIds.map(() => '?').join(',');
    await pool.query(
      `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
       WHERE instance_id IN (${ph}) AND player_id = ?`,
      [...troopIds, playerId]
    );

    // 2. 收集该组所有特效卡（称号/成就/宝物）
    const effectCardIds = [
      mergedWithPrev[`${charKey}_title`],
      mergedWithPrev[`${charKey}_achievement`],
      mergedWithPrev[`${charKey}_treasure`],
    ].filter(Boolean);

    // 3. 鏌ヨ姣忓紶鐗规晥鍗＄殑 card_type 鍜?card_id锛屽啀鏌ラ厤缃〃鑾峰彇 special_effect
    for (const instanceId of effectCardIds) {
      const [cardRows] = await pool.query(
        'SELECT card_type, card_id FROM player_cards WHERE instance_id = ? AND player_id = ?',
        [instanceId, playerId]
      );
      if (!cardRows.length) continue;
      const { card_type, card_id } = cardRows[0];

      const bonus = await getCardSpecialEffect(card_type, card_id);
      if (Object.keys(bonus).length === 0) continue;

      // 4. 绱姞鍒拌缁勯儴闃熷崱
      const sets = Object.entries(bonus).map(([field, val]) => `${field} = ${field} + ${val}`).join(', ');
      await pool.query(
        `UPDATE player_cards SET ${sets} WHERE instance_id IN (${ph}) AND player_id = ?`,
        [...troopIds, playerId]
      );
    }
  }

  return {
    success: true,
    isActive,
    garrisonTroopTotal: totalTroopsConfigured,
    minTroopsForActive: MIN_GARRISON_TOTAL_TROOPS,
    belowTroopThreshold,
  };
}

/**
 * 娓呯┖椹诲畧妲戒綅
 */
async function clearGarrison(playerId, cityId, slotNumber) {
  if (!cityId || String(cityId).trim() === '') {
    return { success: false, error: '缺少 cityId' };
  }
  const [existing] = await pool.query(
    'SELECT * FROM player_garrison WHERE player_id = ? AND city_id = ? AND garrison_slot = ?',
    [playerId, cityId, slotNumber]
  );
  if (existing.length > 0) {
    const g = existing[0];
    const troopIds = [g.char1_troop1, g.char1_troop2, g.char2_troop1, g.char2_troop2].filter(Boolean);
    if (troopIds.length > 0) {
      const ph = troopIds.map(() => '?').join(',');
      await pool.query(
        `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
         WHERE instance_id IN (${ph}) AND player_id = ?`,
        [...troopIds, playerId]
      );
    }
  }

  const nullSets = CARD_FIELDS.map(f => `${f} = NULL`).join(', ');
  await pool.query(
    `UPDATE player_garrison SET ${nullSets}, is_active = FALSE
     WHERE player_id = ? AND city_id = ? AND garrison_slot = ?`,
    [playerId, cityId, slotNumber]
  );
  return { success: true };
}

/**
 * 鍩庢睜鏄撲富锛氬嵏闄ら潪鑳滄柟鍦ㄦ湰鍩庣殑鏁寸粍椹诲畧锛堜笌 clearGarrison 涓€鑷达紝閬垮厤 city_id 宸叉竻浣嗗崱鐗屼粛鍗犱綅瀵艰嚧 UI/缁熻鑴忔暟鎹級
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} conn
 * @param {string} cityId
 * @param {string} winnerFactionId
 */
async function stripGarrisonOnCityConquest(conn, cityId, winnerFactionId) {
  const [rows] = await conn.query(
    `SELECT g.char1_troop1, g.char1_troop2, g.char2_troop1, g.char2_troop2
     FROM player_garrison g
     JOIN players p ON g.player_id = p.player_id
     WHERE g.city_id = ? AND p.faction_id != ?`,
    [cityId, winnerFactionId]
  );
  const troopIds = [...new Set(
    (rows || []).flatMap((g) => GARRISON_TROOP_FIELDS.map((f) => g[f]).filter(Boolean))
  )];
  if (troopIds.length > 0) {
    const ph = troopIds.map(() => '?').join(',');
    await conn.query(
      `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
       WHERE instance_id IN (${ph})`,
      troopIds
    );
  }
  await conn.query(
    `DELETE g FROM player_garrison g
     JOIN players p ON g.player_id = p.player_id
     WHERE g.city_id = ? AND p.faction_id != ?`,
    [cityId, winnerFactionId]
  );
}

/**
 * 鑾峰彇鏌愪釜鍩庡競鐨勬墍鏈夋縺娲婚┗瀹堥厤缃紙鎸夊畼鑱屼紭鍏堢骇鎺掑簭锛? * 鐢ㄤ簬鏀诲煄鏃惰幏鍙栭槻瀹堣€呴槦鍒? * @param {string} cityId
 * @param {string|null|undefined} ownerFactionId 鍩庢睜褰撳墠褰掑睘鍔垮姏锛涗粎缁熻鏈娍鍔涢┗瀹堬紝閬垮厤鏄撲富鍚庤剰鏁版嵁
 */
async function getCityDefenders(cityId, ownerFactionId) {
  let sql = `
     SELECT g.*, p.character_name, p.faction_id, p.faction_name,
            p.current_position_id, p.current_position_name, p.position_level,
            p.on_duty
     FROM player_garrison g
     JOIN players p ON g.player_id = p.player_id
     WHERE g.city_id = ? AND g.is_active = TRUE`;
  const params = [cityId];
  if (ownerFactionId != null && ownerFactionId !== '') {
    sql += ' AND p.faction_id = ?';
    params.push(ownerFactionId);
  }
  sql += ' ORDER BY p.position_level ASC, g.garrison_slot ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * 鎶寕涓婇樀闃插畧鑰咃細浠呯湅 players.on_duty + on_duty_city_id锛屼笌椹诲湴缂栫粍琛ㄦ棤鍏炽€? * 鎴樻枟鍗曚綅鏉ヨ嚜涓婇樀缂栫粍锛坕s_equipped锛夛紝瑙?buildDefenseUnitsFromMainLineup銆? */
async function getCityOnDutyDefenders(cityId, ownerFactionId) {
  let sql = `
     SELECT p.player_id, p.character_name, p.faction_id, p.faction_name,
            p.current_position_id, p.current_position_name, p.position_level,
            p.on_duty, p.on_duty_city_id,
            0 AS garrison_slot,
            'main_lineup' AS defense_source
     FROM players p
     INNER JOIN cities c ON c.city_id = ?
     WHERE p.on_duty = TRUE
       AND p.on_duty_city_id = ?
       AND c.faction_id IS NOT NULL
       AND p.faction_id = c.faction_id`;
  const params = [cityId, cityId];
  if (ownerFactionId != null && ownerFactionId !== '') {
    sql += ' AND p.faction_id = ?';
    params.push(ownerFactionId);
  }
  sql += ' ORDER BY p.position_level ASC, p.player_id ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * 鑾峰彇鏌愪釜鍩庡競鐨勬櫘閫氶┗瀹堥槻瀹堣€咃紙on_duty=FALSE锛屾寜瀹樿亴浼樺厛绾ф帓搴忥級
 */
async function getCityGarrisonDefenders(cityId, ownerFactionId) {
  let sql = `
     SELECT g.*, p.character_name, p.faction_id, p.faction_name,
            p.current_position_id, p.current_position_name, p.position_level,
            p.on_duty
     FROM player_garrison g
     JOIN players p ON g.player_id = p.player_id
     WHERE g.city_id = ? AND g.is_active = TRUE AND (p.on_duty = FALSE OR p.on_duty IS NULL)`;
  const params = [cityId];
  if (ownerFactionId != null && ownerFactionId !== '') {
    sql += ' AND p.faction_id = ?';
    params.push(ownerFactionId);
  }
  sql += ' ORDER BY p.position_level ASC, g.garrison_slot ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * 鑾峰彇鍩庡競椹诲畧缁熻锛堢敤浜庡湴鍥炬樉绀猴級
 */
async function getCityGarrisonStats() {
  const [rows] = await pool.query(
    `SELECT g.city_id, g.city_name,
            COUNT(DISTINCT g.player_id) AS player_count,
            COUNT(*) AS slot_count
     FROM player_garrison g
     JOIN players p ON g.player_id = p.player_id
     JOIN cities c ON c.city_id = g.city_id
     WHERE g.is_active = TRUE AND g.city_id IS NOT NULL
       AND c.faction_id IS NOT NULL AND p.faction_id = c.faction_id
     GROUP BY g.city_id, g.city_name
     ORDER BY slot_count DESC`
  );
  return rows;
}


/**
 * 浠庨┗瀹堥厤缃瀯寤烘垬鏂楀崟浣嶏紙鐢ㄤ簬寮傛PVE闃插畧锛? * 鍙湁鍏靛姏 >= MIN_TROOPS_TO_DEFEND 鐨勯儴闃熸墠鍙傛垬
 * 

 */
async function clearInvalidOnDutySelection(playerId) {
  try {
    const [result] = await pool.query(
      `UPDATE players p
       LEFT JOIN cities c ON c.city_id = p.on_duty_city_id
       SET p.on_duty = FALSE, p.on_duty_city_id = NULL
       WHERE p.player_id = ?
         AND (p.on_duty = TRUE OR p.on_duty = 1)
         AND (
           p.on_duty_city_id IS NULL
           OR c.city_id IS NULL
           OR c.faction_id IS NULL
           OR p.faction_id IS NULL
           OR p.faction_id != c.faction_id
         )`,
      [playerId]
    );
    return (result.affectedRows || 0) > 0;
  } catch (e) {
    // 未执行 migrations/add-players-on-duty-city-id.sql 时无 on_duty_city_id 列，勿阻断 profile
    if (e.code === 'ER_BAD_FIELD_ERROR' || /Unknown column/i.test(e.message || '')) {
      console.warn('[Garrison] clearInvalidOnDutySelection skipped (schema):', e.message);
      return false;
    }
    throw e;
  }
}

module.exports = {
  // ── CRUD + 城市防守者查询（本文件实现）──
  getPlayerGarrisons,
  getPlayerGarrisonsForCity,
  getGarrisonSlot,
  saveGarrison,
  clearGarrison,
  stripGarrisonOnCityConquest,
  getCityDefenders,
  getCityOnDutyDefenders,
  getCityGarrisonDefenders,
  getCityGarrisonStats,
  clearInvalidOnDutySelection,
  // ── 工具函数（本文件实现）──
  sumTroopInstancesTotalTroops,
  sumMainLineupEquippedTroopTroops,
  sumMainLineupBattleFoodDeployCost,
  validateMainLineupBattleGateOnConn,
  MIN_GARRISON_TOTAL_TROOPS,
  MIN_MAIN_LINEUP_TROOPS_BATTLE,
  // ── 防守单位构建（再导出自 garrisonBuildService）──
  MIN_TROOPS_TO_DEFEND:                              garrisonBuildService.MIN_TROOPS_TO_DEFEND,
  getMainLineupAttributeBonusBySlot:                 garrisonBuildService.getMainLineupAttributeBonusBySlot,
  getGarrisonSlotAttributeBonusByChar:               garrisonBuildService.getGarrisonSlotAttributeBonusByChar,
  buildDefenseUnits:                                 garrisonBuildService.buildDefenseUnits,
  buildDefenseUnitsFromMainLineup:                   garrisonBuildService.buildDefenseUnitsFromMainLineup,
  applyAuthoritativeSiegePvpAttackerLineupCasualties: garrisonBuildService.applyAuthoritativeSiegePvpAttackerLineupCasualties,
  mapBuiltUnitsToSiegeNpcFormat:                     garrisonBuildService.mapBuiltUnitsToSiegeNpcFormat,
};
