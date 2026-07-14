/**
 * 驻守服务 - 驻守配置 CRUD、城市防守者查询
 *
 * 防守单位构建（属性加成计算、buildDefenseUnits 等）已提取至 garrisonBuildService.js。
 * 此文件保持对外公开 API 不变，仍从 garrisonBuildService 再导出这些函数。
 *
 * **有效守军（产品常量 `MIN_GARRISON_TOTAL_TROOPS`）**：凡对外「谁算在守这座城」的列表、统计、遇袭、
 * 攻城玩家守军环节，一律经 `buildDefenderLineupForCityDefense` / `filterCityDefenseRowsByMinStationedTroop`，
 * 不得仅凭 `player_garrison.is_active` 判定（见该常量注释）。
 *
 * @module backend/services/garrisonService
 */

const { pool } = require('../database/connection');
const { mapGarrisonApiRow, mapGarrisonApiRows } = require('../constants/lineupSets');
const garrisonBuildService = require('./garrisonBuildService');

// 驻守槽位中所有卡牌字段
const CARD_FIELDS = [
  'char1_card', 'char1_equipment_card', 'char1_title', 'char1_achievement', 'char1_treasure', 'char1_troop1', 'char1_troop2',
  'char2_card', 'char2_equipment_card', 'char2_title', 'char2_achievement', 'char2_treasure', 'char2_troop1', 'char2_troop2',
];

const GARRISON_TROOP_FIELDS = ['char1_troop1', 'char1_troop2', 'char2_troop1', 'char2_troop2'];

/**
 * 驻地槽 / 披挂待战：视为「有效防守驻军」的最低总兵力（**当前**可出战兵力之和，与 `buildDefenseUnits` /
 * `buildDefenseUnitsFromMainLineup` 口径一致，与开战上阵编组下限 `MIN_MAIN_LINEUP_TROOPS_BATTLE` 无关）。
 *
 * **通用规则（列表、统计、攻城、在线遇袭等一律遵守）**：
 * - 仅当本阈值判定为「达到」时，该防守者才参与对外展示、遇袭候选、与 `initiateSiege` 的玩家守军环节。
 * - `player_garrison.is_active` 在保存时按当时配置写入，**战后掉兵可能仍为 TRUE**；因此**禁止**仅凭
 *   `is_active` 或 SQL 计数代表「有效守军」，必须经过 `buildDefenderLineupForCityDefense`（或同等
 *   build + sum）复核。
 */
const MIN_GARRISON_TOTAL_TROOPS = 800;

/** 开战 / 攻城等：上阵编组（is_equipped 部队）总兵力下限，全战斗通用 */
const MIN_MAIN_LINEUP_TROOPS_BATTLE = 200;

// 单部队参战最低兵力（兵力为0不参战；槽位总兵力见 MIN_GARRISON_TOTAL_TROOPS）
const MIN_TROOPS_TO_DEFEND = 1;

/**
 * @param {string} playerId
 * @returns {Promise<string|null>}
 */
async function getPlayerMainCityId(playerId) {
  const [rows] = await pool.query(
    'SELECT main_city_id FROM players WHERE player_id = ? LIMIT 1',
    [playerId],
  );
  const mid = rows[0]?.main_city_id;
  return mid != null && String(mid).trim() !== '' ? String(mid).trim() : null;
}

/**
 * 换主城时：把旧主城驻地行迁到新城，并删除其它城池的驻地行。
 * @param {import('mysql2').PoolConnection} conn
 * @param {string} playerId
 * @param {string|null} fromCityId
 * @param {string} toCityId
 */
async function relocateGarrisonToMainCity(conn, playerId, fromCityId, toCityId) {
  const pid = String(playerId);
  const toId = String(toCityId);
  const fromId = fromCityId != null && String(fromCityId).trim() !== '' ? String(fromCityId).trim() : null;
  if (fromId && fromId !== toId) {
    await conn.query(
      "DELETE FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ?",
      [pid, toId],
    );
    await conn.query(
      "UPDATE player_lineup_sets SET city_id = ? WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ?",
      [toId, pid, fromId],
    );
  }
  await conn.query(
    "DELETE FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id <> ?",
    [pid, toId],
  );
}

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
 * @param {{ foodCostMultiplier?: number }} [opts]
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
async function validateMainLineupBattleGateOnConn(conn, playerId, opts = {}) {
  const troops = await sumMainLineupEquippedTroopTroops(conn, playerId);
  if (troops < MIN_MAIN_LINEUP_TROOPS_BATTLE) {
    return {
      ok: false,
      error: `上阵编组总兵力需≥${MIN_MAIN_LINEUP_TROOPS_BATTLE}（当前 ${troops}）`,
    };
  }
  const [pRows] = await conn.query('SELECT food FROM players WHERE player_id = ? FOR UPDATE', [playerId]);
  const food = Number(pRows[0]?.food) || 0;
  const baseNeed = await sumMainLineupBattleFoodDeployCost(conn, playerId);
  const mult = Math.max(1, Math.floor(Number(opts.foodCostMultiplier) || 1));
  const need = baseNeed * mult;
  if (food < need) {
    return {
      ok: false,
      error: mult > 1
        ? `出征需粮草 ${need}（常规 ${baseNeed} × ${mult}；当前 ${food}），粮草不足`
        : `出征需粮草 ${need}（当前 ${food}），粮草不足`,
    };
  }
  return { ok: true, foodNeed: need };
}

/**
 * 扣减出征粮草（须与 validateMainLineupBattleGateOnConn 同口径；调用前须已 FOR UPDATE 玩家行）。
 * @param {import('mysql2').PoolConnection} conn
 * @param {string} playerId
 * @param {{ foodCostMultiplier?: number, foodNeed?: number }} [opts]
 */
async function deductMainLineupBattleFoodDeployCostOnConn(conn, playerId, opts = {}) {
  const mult = Math.max(1, Math.floor(Number(opts.foodCostMultiplier) || 1));
  const need =
    opts.foodNeed != null && Number.isFinite(Number(opts.foodNeed))
      ? Math.max(0, Math.floor(Number(opts.foodNeed)))
      : (await sumMainLineupBattleFoodDeployCost(conn, playerId)) * mult;
  if (need <= 0) return 0;
  await conn.query('UPDATE players SET food = GREATEST(0, food - ?) WHERE player_id = ?', [need, playerId]);
  const statisticsDeltaService = require('./statisticsDeltaService');
  await statisticsDeltaService.incrementSpent(playerId, { food: need });
  return need;
}

/**
 * 整编防守方当前可出战部队并计算总兵力：**唯一**与 `cityService.initiateSiege` 对齐的「是否算有效守军」入口。
 *
 * @param {object} defRow `player_garrison` 联结 `players` 的完整行，或 `getCityOnDutyDefenders` 返回的合成行
 *   （须含 `player_id`；若 `defense_source === 'main_lineup'` 则走上阵编组，否则走驻地槽 `buildDefenseUnits`）。
 * @returns {{ units: Array, totalTroops: number, meetsStationedTroopGate: boolean }}
 */
async function buildDefenderLineupForCityDefense(defRow) {
  const fromMainLineup = defRow.defense_source === 'main_lineup';
  const units = fromMainLineup
    ? await garrisonBuildService.buildDefenseUnitsFromMainLineup(defRow.player_id)
    : await garrisonBuildService.buildDefenseUnits(defRow);
  const totalTroops = units.reduce((sum, u) => sum + (u.currentTroops || 0), 0);
  return {
    units,
    totalTroops,
    meetsStationedTroopGate: totalTroops >= MIN_GARRISON_TOTAL_TROOPS,
  };
}

/**
 * 保留「当前总兵力 ≥ MIN_GARRISON_TOTAL_TROOPS」的防守行，**顺序不变**（用于 defenders 列表、在线遇袭、统计等）。
 * @param {object[]} rows
 * @param {number} [chunkSize]
 */
async function filterCityDefenseRowsByMinStationedTroop(rows, chunkSize = 16) {
  if (!rows || rows.length === 0) return [];
  const out = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map(async (r) => {
      try {
        return await buildDefenderLineupForCityDefense(r);
      } catch (err) {
        console.warn(
          '[Garrison] skip row in troop filter',
          { playerId: r?.player_id, cityId: r?.city_id, garrisonSlot: r?.garrison_slot },
          err?.message || err,
        );
        return { units: [], totalTroops: 0, meetsStationedTroopGate: false };
      }
    }));
    for (let j = 0; j < chunk.length; j++) {
      if (results[j].meetsStationedTroopGate) out.push(chunk[j]);
    }
  }
  return out;
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
    "SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' ORDER BY city_id, lineup_slot",
    [playerId]
  );
  return mapGarrisonApiRows(rows);
}

/**
 * 玩家所有驻地槽位占用的卡牌实例 id 集合（与前端 `collectGarrisonOccupiedInstanceIds` 同口径：
 * 取所有 garrison 行的 `CARD_FIELDS` 非空值）。供上阵编组排除被驻守占用的卡。
 * @param {string} playerId
 * @returns {Promise<Set<string>>}
 */
async function getGarrisonOccupiedInstanceIds(playerId) {
  const rows = await getPlayerGarrisons(playerId);
  const ids = new Set();
  for (const g of rows) {
    for (const f of CARD_FIELDS) {
      if (g[f]) ids.add(g[f]);
    }
  }
  return ids;
}

/**
 * 某玩家在某城的驻地槽位行（卡池 A/B）
 * @param {string} playerId
 * @param {string} cityId
 */
async function getPlayerGarrisonsForCity(playerId, cityId) {
  if (!cityId) return [];
  const [rows] = await pool.query(
    "SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ? ORDER BY lineup_slot",
    [playerId, cityId]
  );
  return mapGarrisonApiRows(rows);
}

/**
 * 鑾峰彇鐜╁鏌愪釜妲戒綅鐨勯┗瀹堥厤缃? */
async function getGarrisonSlot(playerId, cityId, slotNumber) {
  if (!cityId) return null;
  const [rows] = await pool.query(
    "SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ? AND lineup_slot = ?",
    [playerId, cityId, slotNumber]
  );
  return mapGarrisonApiRow(rows[0] || null);
}

/**
 * 淇濆瓨椹诲畧閰嶇疆锛圛NSERT ON DUPLICATE KEY UPDATE锛? */
async function saveGarrison(playerId, slotNumber, config) {
  const incomingCity = config && config.cityId;
  if (!incomingCity || String(incomingCity).trim() === '') {
    return { success: false, error: '缺少 cityId，无法按城池保存驻地编组' };
  }
  const mainCityId = await getPlayerMainCityId(playerId);
  if (!mainCityId) {
    return { success: false, error: '请先设置主城后再配置驻地编组' };
  }
  if (String(incomingCity).trim() !== mainCityId) {
    return { success: false, error: '驻地编组仅可配置在主城' };
  }
  const prevSlot = await getGarrisonSlot(playerId, incomingCity, slotNumber);
  const mergedWithPrev = mergeGarrisonPayloadWithPrevRow(prevSlot, config);

  const targetCityId = String(mergedWithPrev.cityId || '').trim();
  if (!targetCityId) {
    return { success: false, error: '缺少 cityId，无法按城池保存驻地编组' };
  }
  if (targetCityId !== mainCityId) {
    return { success: false, error: '驻地编组仅可配置在主城' };
  }

  const instanceIds = CARD_FIELDS.map(f => mergedWithPrev[f]).filter(Boolean);

  // 检查卡牌是否已被其他驻守槽位占用
  if (instanceIds.length > 0) {
    const placeholders = instanceIds.map(() => '?').join(',');
    const [conflicts] = await pool.query(
      `SELECT g.lineup_slot, g.city_id, pc.instance_id
       FROM player_lineup_sets g
       JOIN player_cards pc ON pc.instance_id IN (${placeholders})
       WHERE g.player_id = ? AND g.lineup_scope = 'garrison'
         AND NOT (g.city_id <=> ? AND g.lineup_slot = ?)
         AND (${CARD_FIELDS.map(f => `g.${f} = pc.instance_id`).join(' OR ')})`,
      [...instanceIds, playerId, mergedWithPrev.cityId, slotNumber]
    );
    if (conflicts.length > 0) {
      return {
        success: false,
        error: '卡牌已被其他驻地卡池占用',
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

    const lineupExtraService = require('./lineupExtraService');
    const extraOccupied = await lineupExtraService.getOccupiedInstanceIds(playerId);
    const hitExtra = instanceIds.some((id) => extraOccupied.has(String(id)));
    if (hitExtra) {
      return { success: false, error: '部分卡牌已在上阵编组 Extra 中，请先卸下再配置驻守' };
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
    `INSERT INTO player_lineup_sets (
      player_id, lineup_scope, city_id, lineup_slot, city_name,
      char1_card, char1_equipment_card, char1_title, char1_achievement, char1_treasure, char1_troop1, char1_troop2,
      char2_card, char2_equipment_card, char2_title, char2_achievement, char2_treasure, char2_troop1, char2_troop2,
      is_active
    ) VALUES (?, 'garrison', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      city_name = VALUES(city_name),
      char1_card = VALUES(char1_card), char1_equipment_card = VALUES(char1_equipment_card),
      char1_title = VALUES(char1_title), char1_achievement = VALUES(char1_achievement),
      char1_treasure = VALUES(char1_treasure), char1_troop1 = VALUES(char1_troop1), char1_troop2 = VALUES(char1_troop2),
      char2_card = VALUES(char2_card), char2_equipment_card = VALUES(char2_equipment_card),
      char2_title = VALUES(char2_title), char2_achievement = VALUES(char2_achievement),
      char2_treasure = VALUES(char2_treasure), char2_troop1 = VALUES(char2_troop1), char2_troop2 = VALUES(char2_troop2),
      is_active = VALUES(is_active)`,
    [
      playerId, mergedWithPrev.cityId || null, slotNumber, mergedWithPrev.cityName || null,
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

      const bonus = await garrisonBuildService.getCardSpecialEffect(card_type, card_id);
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
  const mainCityId = await getPlayerMainCityId(playerId);
  if (!mainCityId) {
    return { success: false, error: '请先设置主城后再操作驻地编组' };
  }
  if (String(cityId).trim() !== mainCityId) {
    return { success: false, error: '驻地编组仅可配置在主城' };
  }
  const [existing] = await pool.query(
    "SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ? AND lineup_slot = ?",
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
    `UPDATE player_lineup_sets SET ${nullSets}, is_active = FALSE
     WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ? AND lineup_slot = ?`,
    [playerId, cityId, slotNumber]
  );
  return { success: true };
}

/**
 * 重算玩家全部驻地行的部队 bonus_*（宝物/称号卸下或耗尽后与上阵编组口径一致）
 * @param {Function} queryFn - (sql, params) => pool.query / conn.query
 * @param {string} playerId
 */
async function refreshAllGarrisonTroopEffectBonuses(queryFn, playerId) {
  if (!playerId) return;
  const {
    getPlayerFactionTroopMaxTroopsBonus,
  } = require('./factionGameplayBonusService');
  const factionMaxBonus = await getPlayerFactionTroopMaxTroopsBonus(
    { query: (sql, params) => queryFn(sql, params) },
    playerId,
  );
  const [garrisonRows] = await queryFn(
    "SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison'",
    [playerId],
  );
  if (!Array.isArray(garrisonRows)) return;
  for (const g of garrisonRows) {
    for (const charKey of ['char1', 'char2']) {
      const troopIds = [g[`${charKey}_troop1`], g[`${charKey}_troop2`]].filter(Boolean);
      if (troopIds.length === 0) continue;

      const ph = troopIds.map(() => '?').join(',');
      await queryFn(
        `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
         WHERE instance_id IN (${ph}) AND player_id = ?`,
        [...troopIds, playerId],
      );

      const effectInstanceIds = [
        g[`${charKey}_title`],
        g[`${charKey}_achievement`],
        g[`${charKey}_treasure`],
      ].filter(Boolean);

      for (const instanceId of effectInstanceIds) {
        const [cardRows] = await queryFn(
          'SELECT card_type, card_id, uses_remaining FROM player_cards WHERE instance_id = ? AND player_id = ?',
          [instanceId, playerId],
        );
        const cardRow = Array.isArray(cardRows) ? cardRows[0] : cardRows;
        if (!cardRow) continue;
        if (
          cardRow.card_type === 'treasure'
          && cardRow.uses_remaining != null
          && Number(cardRow.uses_remaining) <= 0
        ) {
          continue;
        }
        const bonus = await garrisonBuildService.getCardSpecialEffect(cardRow.card_type, cardRow.card_id);
        if (Object.keys(bonus).length === 0) continue;
        const sets = Object.entries(bonus).map(([field, val]) => `${field} = ${field} + ${val}`).join(', ');
        await queryFn(
          `UPDATE player_cards SET ${sets} WHERE instance_id IN (${ph}) AND player_id = ?`,
          [...troopIds, playerId],
        );
      }

      if (factionMaxBonus > 0) {
        await queryFn(
          `UPDATE player_cards SET bonus_max_troops = bonus_max_troops + ?
           WHERE instance_id IN (${ph}) AND player_id = ?`,
          [factionMaxBonus, ...troopIds, playerId],
        );
      }

      const [troopList] = await queryFn(
        `SELECT pc.instance_id, pc.current_troops, pc.bonus_max_troops, ct.max_troops AS cfg_max
         FROM player_cards pc
         JOIN config_troops ct ON pc.card_id = ct.troop_id
         WHERE pc.instance_id IN (${ph}) AND pc.player_id = ?`,
        [...troopIds, playerId],
      );
      for (const t of troopList || []) {
        const maxTroops = (t.cfg_max || 0) + (t.bonus_max_troops || 0);
        const cur = t.current_troops ?? maxTroops;
        if (cur > maxTroops) {
          await queryFn(
            'UPDATE player_cards SET current_troops = ? WHERE instance_id = ? AND player_id = ?',
            [maxTroops, t.instance_id, playerId],
          );
        }
      }
    }
  }
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
     FROM player_lineup_sets g
     JOIN players p ON g.player_id = p.player_id
     WHERE g.lineup_scope = 'garrison' AND g.city_id = ? AND p.faction_id != ?`,
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
    `DELETE g FROM player_lineup_sets g
     JOIN players p ON g.player_id = p.player_id
     WHERE g.lineup_scope = 'garrison' AND g.city_id = ? AND p.faction_id != ?`,
    [cityId, winnerFactionId]
  );
}

/**
 * 某城「驻地槽」防守者列表（API：`GET /api/garrisons/city/:cityId/defenders`）。
 * 先按库 `is_active` 缩小候选，再按 **当前** 整编兵力 ≥ `MIN_GARRISON_TOTAL_TROOPS` 过滤（与攻城一致）。
 */
async function getCityDefenders(cityId, ownerFactionId) {
  let sql = `
     SELECT g.*, p.character_name, p.faction_id, p.faction_name,
            p.current_position_id, p.current_position_name, p.position_level,
            p.on_duty
     FROM player_lineup_sets g
     JOIN players p ON g.player_id = p.player_id
     WHERE g.lineup_scope = 'garrison' AND g.city_id = ? AND g.is_active = TRUE`;
  const params = [cityId];
  if (ownerFactionId != null && ownerFactionId !== '') {
    sql += ' AND p.faction_id = ?';
    params.push(ownerFactionId);
  }
  sql += ' ORDER BY p.position_level ASC, g.lineup_slot ASC';
  const [rows] = await pool.query(sql, params);
  return filterCityDefenseRowsByMinStationedTroop(mapGarrisonApiRows(rows));
}

/**
 * 披挂上阵待战本城的玩家（与 `player_garrison` 无直接关系；战力来自上阵编组）。
 * 返回前同样必须满足 **当前** 整编兵力 ≥ `MIN_GARRISON_TOTAL_TROOPS`，与 `initiateSiege` 一致。
 */
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
  return filterCityDefenseRowsByMinStationedTroop(rows);
}

/**
 * 普通驻地槽防守者，供攻城队列等使用。
 * 在 `is_active` 候选之上再按 **当前** 整编兵力 ≥ `MIN_GARRISON_TOTAL_TROOPS` 过滤。
 */
async function getCityGarrisonDefenders(cityId, ownerFactionId) {
  let sql = `
     SELECT g.*, p.character_name, p.faction_id, p.faction_name,
            p.current_position_id, p.current_position_name, p.position_level
     FROM player_lineup_sets g
     JOIN players p ON g.player_id = p.player_id
     WHERE g.lineup_scope = 'garrison' AND g.city_id = ? AND g.is_active = TRUE`;
  const params = [cityId];
  if (ownerFactionId != null && ownerFactionId !== '') {
    sql += ' AND p.faction_id = ?';
    params.push(ownerFactionId);
  }
  sql += ' ORDER BY p.position_level ASC, g.lineup_slot ASC';
  const [rows] = await pool.query(sql, params);
  return filterCityDefenseRowsByMinStationedTroop(mapGarrisonApiRows(rows));
}

/**
 * 城市驻地统计（大地图城备 tooltip `GET /api/garrisons/stats/cities`）。
 * `slot_count` / `player_count` 仅计 **当前** 整编兵力达 `MIN_GARRISON_TOTAL_TROOPS` 的槽位（与 `initiateSiege` 一致）。
 */
async function getCityGarrisonStats() {
  let allSlots;
  try {
    [allSlots] = await pool.query(
      `SELECT g.*
       FROM player_lineup_sets g
       JOIN players p ON g.player_id = p.player_id
       JOIN cities c ON c.city_id = g.city_id
       WHERE g.lineup_scope = 'garrison' AND g.is_active = TRUE AND g.city_id IS NOT NULL AND g.city_id <> ''
         AND c.faction_id IS NOT NULL AND p.faction_id = c.faction_id`,
    );
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR' || /Unknown column/i.test(err.message || '')) {
      console.error('[Garrison] getCityGarrisonStats schema mismatch:', err.message);
      return [];
    }
    throw err;
  }
  let effective = [];
  try {
    effective = await filterCityDefenseRowsByMinStationedTroop(mapGarrisonApiRows(allSlots));
  } catch (err) {
    console.error('[Garrison] getCityGarrisonStats filter failed:', err);
    if (err.code === 'ER_BAD_FIELD_ERROR' || /Unknown column/i.test(err.message || '')) {
      return [];
    }
    throw err;
  }
  const byCity = new Map();
  for (const row of effective) {
    const cid = row.city_id;
    let agg = byCity.get(cid);
    if (!agg) {
      agg = { city_name: row.city_name, slotCount: 0, playerIds: new Set() };
      byCity.set(cid, agg);
    }
    agg.slotCount += 1;
    agg.playerIds.add(row.player_id);
  }
  return [...byCity.entries()]
    .map(([city_id, v]) => ({
      city_id,
      city_name: v.city_name,
      player_count: v.playerIds.size,
      slot_count: v.slotCount,
    }))
    .sort((a, b) => b.slot_count - a.slot_count);
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
  getGarrisonOccupiedInstanceIds,
  getPlayerGarrisonsForCity,
  getGarrisonSlot,
  saveGarrison,
  clearGarrison,
  relocateGarrisonToMainCity,
  getPlayerMainCityId,
  stripGarrisonOnCityConquest,
  getCityDefenders,
  getCityOnDutyDefenders,
  getCityGarrisonDefenders,
  getCityGarrisonStats,
  buildDefenderLineupForCityDefense,
  filterCityDefenseRowsByMinStationedTroop,
  clearInvalidOnDutySelection,
  // ── 工具函数（本文件实现）──
  sumTroopInstancesTotalTroops,
  sumMainLineupEquippedTroopTroops,
  sumMainLineupBattleFoodDeployCost,
  validateMainLineupBattleGateOnConn,
  deductMainLineupBattleFoodDeployCostOnConn,
  MIN_GARRISON_TOTAL_TROOPS,
  MIN_MAIN_LINEUP_TROOPS_BATTLE,
  refreshAllGarrisonTroopEffectBonuses,
  // ── 防守单位构建（再导出自 garrisonBuildService）──
  MIN_TROOPS_TO_DEFEND:                              garrisonBuildService.MIN_TROOPS_TO_DEFEND,
  getMainLineupAttributeBonusBySlot:                 garrisonBuildService.getMainLineupAttributeBonusBySlot,
  getGarrisonSlotAttributeBonusByChar:               garrisonBuildService.getGarrisonSlotAttributeBonusByChar,
  buildDefenseUnits:                                 garrisonBuildService.buildDefenseUnits,
  buildDefenseUnitsFromMainLineup:                   garrisonBuildService.buildDefenseUnitsFromMainLineup,
  applyAuthoritativePvpAutoDuelAttackerLineupCasualties: garrisonBuildService.applyAuthoritativePvpAutoDuelAttackerLineupCasualties,
  mapBuiltUnitsToSiegeNpcFormat:                     garrisonBuildService.mapBuiltUnitsToSiegeNpcFormat,
};
