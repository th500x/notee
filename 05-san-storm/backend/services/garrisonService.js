/**
 * 驻守服务 - 驻守配置CRUD、城市防守者查询、防守单位构建
 * 
 * @module backend/services/garrisonService
 */

const { pool } = require('../database/connection');
const { applyTroopDurabilityExhaustion } = require('./troopDurabilityService');
const equipmentSetService = require('./equipmentSetService');

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

/** special_effect 字段映射 → player_cards bonus 字段（复用 players.js 的逻辑） */
const EFFECT_FIELD_MAP = {
  'max_troops_bonus': 'bonus_max_troops',
  'attack_bonus': 'bonus_attack',
  'defense_bonus': 'bonus_defense',
  'speed_bonus': 'bonus_speed',
  'movement_bonus': 'bonus_movement',
};

function parseSpecialEffect(effectStr) {
  if (!effectStr) return {};
  const bonus = {};
  effectStr.split(';').forEach(part => {
    const [key, val] = part.trim().split(':');
    if (!key || !val) return;
    const field = EFFECT_FIELD_MAP[key];
    if (field) bonus[field] = parseInt(val) || 0;
  });
  return bonus;
}

async function getCardSpecialEffect(cardType, cardId) {
  const tableMap = {
    'title': { table: 'config_titles', idField: 'title_id' },
    'achievement': { table: 'config_achievements', idField: 'achievement_id' },
  };
  const cfg = tableMap[cardType];
  if (!cfg) return {};
  const [rows] = await pool.query(
    `SELECT special_effect FROM ${cfg.table} WHERE ${cfg.idField} = ?`, [cardId]
  );
  return parseSpecialEffect(rows[0]?.special_effect);
}

function addAttrBonus(target, bonus = {}) {
  if (!bonus || typeof bonus !== 'object') return;
  Object.entries(bonus).forEach(([k, v]) => {
    target[k] = (target[k] || 0) + (Number(v) || 0);
  });
}

async function loadConfigAttributeBonusMap(conn, table, idField, ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  if (uniq.length === 0) return {};
  const ph = uniq.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT ${idField} AS id, attribute_bonus FROM ${table} WHERE ${idField} IN (${ph})`,
    uniq
  );
  const map = {};
  for (const r of rows) {
    let ab = {};
    if (r.attribute_bonus) {
      try { ab = typeof r.attribute_bonus === 'string' ? JSON.parse(r.attribute_bonus) : r.attribute_bonus; } catch {}
    }
    map[r.id] = ab || {};
  }
  return map;
}

function applyCharBonusToCharData(charData, bonus) {
  const b = bonus || {};
  return {
    ...charData,
    combat: Number(charData.combat || 0) + (Number(b.combat || 0) / 10),
    command: Number(charData.command || 0) + (Number(b.command || 0) / 10),
    intelligence: Number(charData.intelligence || 0) + (Number(b.intelligence || 0) / 10),
    luck: Number(charData.luck || 0) + (Number(b.luck || 0) / 10),
    courage: Number(charData.courage || 0) + (Number(b.courage || 0) / 10),
  };
}

async function getMainLineupAttributeBonusBySlot(conn, playerId) {
  const out = { player: {}, character1: {}, character2: {} };
  const [equipped] = await conn.query(
    `SELECT instance_id, card_type, card_id, equipped_by, equipment_set_data
     FROM player_cards
     WHERE player_id = ? AND is_equipped = TRUE
       AND card_type IN ('title','achievement','treasure','equipmentSet')`,
    [playerId]
  );

  const titleIds = equipped.filter(c => c.card_type === 'title').map(c => c.card_id);
  const achIds = equipped.filter(c => c.card_type === 'achievement').map(c => c.card_id);
  const treasureIds = equipped.filter(c => c.card_type === 'treasure').map(c => c.card_id);

  const [titleMap, achMap, treasureMap] = await Promise.all([
    loadConfigAttributeBonusMap(conn, 'config_titles', 'title_id', titleIds),
    loadConfigAttributeBonusMap(conn, 'config_achievements', 'achievement_id', achIds),
    loadConfigAttributeBonusMap(conn, 'config_treasures', 'treasure_id', treasureIds),
  ]);

  const [equipRows] = await conn.query(
    `SELECT pc.instance_id, pc.bound_equipment_set_instance_id,
            ce.luck_bonus, ce.courage_bonus, ce.combat_bonus, ce.command_bonus,
            ce.intelligence_bonus, ce.politics_bonus, ce.charm_bonus
     FROM player_cards pc
     LEFT JOIN config_equipment ce ON ce.equipment_id = pc.card_id
     WHERE pc.player_id = ? AND pc.card_type = 'equipment'`,
    [playerId]
  );
  const equipBonusByInstance = {};
  const boundPieceIdsBySet = {};
  for (const e of equipRows) {
    equipBonusByInstance[e.instance_id] = {
      luck: Number(e.luck_bonus || 0),
      courage: Number(e.courage_bonus || 0),
      combat: Number(e.combat_bonus || 0),
      command: Number(e.command_bonus || 0),
      intelligence: Number(e.intelligence_bonus || 0),
      politics: Number(e.politics_bonus || 0),
      charm: Number(e.charm_bonus || 0),
    };
    if (e.bound_equipment_set_instance_id) {
      if (!boundPieceIdsBySet[e.bound_equipment_set_instance_id]) boundPieceIdsBySet[e.bound_equipment_set_instance_id] = [];
      boundPieceIdsBySet[e.bound_equipment_set_instance_id].push(e.instance_id);
    }
  }

  for (const card of equipped) {
    const slot = card.equipped_by || 'player';
    if (!out[slot]) out[slot] = {};
    if (card.card_type === 'title') addAttrBonus(out[slot], titleMap[card.card_id] || {});
    if (card.card_type === 'achievement') addAttrBonus(out[slot], achMap[card.card_id] || {});
    if (card.card_type === 'treasure') addAttrBonus(out[slot], treasureMap[card.card_id] || {});
    if (card.card_type === 'equipmentSet') {
      const d = equipmentSetService.parseSetData(card.equipment_set_data);
      const slotPieceIds = [
        d.weapon_instance_id,
        d.armor_instance_id,
        d.accessory_1_instance_id,
        d.accessory_2_instance_id,
      ].filter(Boolean);
      const boundPieceIds = boundPieceIdsBySet[card.instance_id] || [];
      const pieceIds = boundPieceIds.length > 0 ? boundPieceIds : slotPieceIds;
      const sum = {};
      pieceIds.forEach((pid) => addAttrBonus(sum, equipBonusByInstance[pid] || {}));
      addAttrBonus(out[slot], sum);
    }
  }
  return out;
}

async function getGarrisonSlotAttributeBonusByChar(conn, garrisonSlot) {
  const out = { char1: {}, char2: {} };
  if (!garrisonSlot) return out;

  const effectIds = [
    garrisonSlot.char1_title, garrisonSlot.char1_achievement, garrisonSlot.char1_treasure, garrisonSlot.char1_equipment_card,
    garrisonSlot.char2_title, garrisonSlot.char2_achievement, garrisonSlot.char2_treasure, garrisonSlot.char2_equipment_card,
  ].filter(Boolean);
  if (effectIds.length === 0) return out;

  const ph = effectIds.map(() => '?').join(',');
  const [cards] = await conn.query(
    `SELECT instance_id, card_type, card_id, equipment_set_data
     FROM player_cards
     WHERE player_id = ? AND instance_id IN (${ph})`,
    [garrisonSlot.player_id, ...effectIds]
  );
  const byInstance = {};
  cards.forEach((c) => { byInstance[c.instance_id] = c; });

  const titleIds = cards.filter(c => c.card_type === 'title').map(c => c.card_id);
  const achIds = cards.filter(c => c.card_type === 'achievement').map(c => c.card_id);
  const treasureIds = cards.filter(c => c.card_type === 'treasure').map(c => c.card_id);
  const [titleMap, achMap, treasureMap] = await Promise.all([
    loadConfigAttributeBonusMap(conn, 'config_titles', 'title_id', titleIds),
    loadConfigAttributeBonusMap(conn, 'config_achievements', 'achievement_id', achIds),
    loadConfigAttributeBonusMap(conn, 'config_treasures', 'treasure_id', treasureIds),
  ]);

  const [equipRows] = await conn.query(
    `SELECT pc.instance_id, pc.bound_equipment_set_instance_id,
            ce.luck_bonus, ce.courage_bonus, ce.combat_bonus, ce.command_bonus,
            ce.intelligence_bonus, ce.politics_bonus, ce.charm_bonus
     FROM player_cards pc
     LEFT JOIN config_equipment ce ON ce.equipment_id = pc.card_id
     WHERE pc.player_id = ? AND pc.card_type = 'equipment'`,
    [garrisonSlot.player_id]
  );
  const equipBonusByInstance = {};
  const boundPieceIdsBySet = {};
  for (const e of equipRows) {
    equipBonusByInstance[e.instance_id] = {
      luck: Number(e.luck_bonus || 0),
      courage: Number(e.courage_bonus || 0),
      combat: Number(e.combat_bonus || 0),
      command: Number(e.command_bonus || 0),
      intelligence: Number(e.intelligence_bonus || 0),
      politics: Number(e.politics_bonus || 0),
      charm: Number(e.charm_bonus || 0),
    };
    if (e.bound_equipment_set_instance_id) {
      if (!boundPieceIdsBySet[e.bound_equipment_set_instance_id]) boundPieceIdsBySet[e.bound_equipment_set_instance_id] = [];
      boundPieceIdsBySet[e.bound_equipment_set_instance_id].push(e.instance_id);
    }
  }

  const applyOne = (charKey, instanceId) => {
    if (!instanceId) return;
    const c = byInstance[instanceId];
    if (!c) return;
    if (c.card_type === 'title') addAttrBonus(out[charKey], titleMap[c.card_id] || {});
    if (c.card_type === 'achievement') addAttrBonus(out[charKey], achMap[c.card_id] || {});
    if (c.card_type === 'treasure') addAttrBonus(out[charKey], treasureMap[c.card_id] || {});
    if (c.card_type === 'equipmentSet') {
      const d = equipmentSetService.parseSetData(c.equipment_set_data);
      const slotPieceIds = [
        d.weapon_instance_id, d.armor_instance_id, d.accessory_1_instance_id, d.accessory_2_instance_id,
      ].filter(Boolean);
      const boundPieceIds = boundPieceIdsBySet[c.instance_id] || [];
      const pieceIds = boundPieceIds.length > 0 ? boundPieceIds : slotPieceIds;
      const sum = {};
      pieceIds.forEach((pid) => addAttrBonus(sum, equipBonusByInstance[pid] || {}));
      addAttrBonus(out[charKey], sum);
    }
  };

  applyOne('char1', garrisonSlot.char1_title);
  applyOne('char1', garrisonSlot.char1_achievement);
  applyOne('char1', garrisonSlot.char1_treasure);
  applyOne('char1', garrisonSlot.char1_equipment_card);
  applyOne('char2', garrisonSlot.char2_title);
  applyOne('char2', garrisonSlot.char2_achievement);
  applyOne('char2', garrisonSlot.char2_treasure);
  applyOne('char2', garrisonSlot.char2_equipment_card);

  return out;
}

/**
 * 获取玩家所有驻守配置
 */
async function getPlayerGarrisons(playerId) {
  const [rows] = await pool.query(
    'SELECT * FROM player_garrison WHERE player_id = ? ORDER BY garrison_slot',
    [playerId]
  );
  return rows;
}

/**
 * 获取玩家某个槽位的驻守配置
 */
async function getGarrisonSlot(playerId, slotNumber) {
  const [rows] = await pool.query(
    'SELECT * FROM player_garrison WHERE player_id = ? AND garrison_slot = ?',
    [playerId, slotNumber]
  );
  return rows[0] || null;
}

/**
 * 保存驻守配置（INSERT ON DUPLICATE KEY UPDATE）
 */
async function saveGarrison(playerId, slotNumber, config) {
  const prevSlot = await getGarrisonSlot(playerId, slotNumber);
  const merged = mergeGarrisonPayloadWithPrevRow(prevSlot, config);

  const instanceIds = CARD_FIELDS.map(f => merged[f]).filter(Boolean);

  // 检查卡牌是否已被其他驻守槽位占用
  if (instanceIds.length > 0) {
    const placeholders = instanceIds.map(() => '?').join(',');
    const [conflicts] = await pool.query(
      `SELECT g.garrison_slot, pc.instance_id
       FROM player_garrison g
       JOIN player_cards pc ON pc.instance_id IN (${placeholders})
       WHERE g.player_id = ? AND g.garrison_slot != ? AND g.is_active = TRUE
         AND (${CARD_FIELDS.map(f => `g.${f} = pc.instance_id`).join(' OR ')})`,
      [...instanceIds, playerId, slotNumber]
    );
    if (conflicts.length > 0) {
      return { success: false, error: `卡牌已被驻守槽位${conflicts[0].garrison_slot}占用` };
    }

    // 检查卡牌是否已被上阵编组占用（is_equipped = TRUE 的卡牌不能用于驻守）
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
        const nextId = merged[f] || null;
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
        error: '核心(金)部队耐久已耗尽，无法用于驻守，仅作纪念与下赛季继承',
      };
    }
  }

  const hasChar = !!(merged.char1_card || merged.char2_card);
  const hasTroop = !!(merged.char1_troop1 || merged.char1_troop2 || merged.char2_troop1 || merged.char2_troop2);
  const troopInstanceIds = GARRISON_TROOP_FIELDS.map((f) => merged[f]).filter(Boolean);
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
      playerId, slotNumber, merged.cityId || null, merged.cityName || null,
      merged.char1_card || null, merged.char1_equipment_card || null,
      merged.char1_title || null, merged.char1_achievement || null, merged.char1_treasure || null,
      merged.char1_troop1 || null, merged.char1_troop2 || null,
      merged.char2_card || null, merged.char2_equipment_card || null,
      merged.char2_title || null, merged.char2_achievement || null, merged.char2_treasure || null,
      merged.char2_troop1 || null, merged.char2_troop2 || null,
      isActive,
    ]
  );

  // ── 重算驻守部队卡的特效加成（复用上阵编组的 applyCardBonusToTroops 逻辑） ──
  // 对 char1 和 char2 各自：先清零部队卡 bonus，再累加所有特效卡的 special_effect
  for (const charKey of ['char1', 'char2']) {
    const troopIds = [merged[`${charKey}_troop1`], merged[`${charKey}_troop2`]].filter(Boolean);
    if (troopIds.length === 0) continue;

    // 1. 清零该组部队卡的 bonus
    const ph = troopIds.map(() => '?').join(',');
    await pool.query(
      `UPDATE player_cards SET bonus_max_troops=0, bonus_attack=0, bonus_defense=0, bonus_speed=0, bonus_movement=0
       WHERE instance_id IN (${ph}) AND player_id = ?`,
      [...troopIds, playerId]
    );

    // 2. 收集该组所有特效卡（称号/成就/宝物）
    const effectCardIds = [
      merged[`${charKey}_title`],
      merged[`${charKey}_achievement`],
      merged[`${charKey}_treasure`],
    ].filter(Boolean);

    // 3. 查询每张特效卡的 card_type 和 card_id，再查配置表获取 special_effect
    for (const instanceId of effectCardIds) {
      const [cardRows] = await pool.query(
        'SELECT card_type, card_id FROM player_cards WHERE instance_id = ? AND player_id = ?',
        [instanceId, playerId]
      );
      if (!cardRows.length) continue;
      const { card_type, card_id } = cardRows[0];

      const bonus = await getCardSpecialEffect(card_type, card_id);
      if (Object.keys(bonus).length === 0) continue;

      // 4. 累加到该组部队卡
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
 * 清空驻守槽位
 */
async function clearGarrison(playerId, slotNumber) {
  // 先获取当前配置，清零部队卡 bonus
  const [existing] = await pool.query(
    'SELECT * FROM player_garrison WHERE player_id = ? AND garrison_slot = ?',
    [playerId, slotNumber]
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
    `UPDATE player_garrison SET city_id = NULL, city_name = NULL, ${nullSets}, is_active = FALSE
     WHERE player_id = ? AND garrison_slot = ?`,
    [playerId, slotNumber]
  );
  return { success: true };
}

/**
 * 城池易主：卸除非胜方在本城的整组驻守（与 clearGarrison 一致，避免 city_id 已清但卡牌仍占位导致 UI/统计脏数据）
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
  const nullSets = CARD_FIELDS.map((f) => `g.${f} = NULL`).join(', ');
  await conn.query(
    `UPDATE player_garrison g
     JOIN players p ON g.player_id = p.player_id
     SET g.is_active = FALSE, g.city_id = NULL, g.city_name = NULL, ${nullSets}
     WHERE g.city_id = ? AND p.faction_id != ?`,
    [cityId, winnerFactionId]
  );
}

/**
 * 获取某个城市的所有激活驻守配置（按官职优先级排序）
 * 用于攻城时获取防守者队列
 * @param {string} cityId
 * @param {string|null|undefined} ownerFactionId 城池当前归属势力；仅统计本势力驻守，避免易主后脏数据
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
 * 披挂上阵防守者：仅看 players.on_duty + on_duty_city_id，与驻地编组表无关。
 * 战斗单位来自上阵编组（is_equipped），见 buildDefenseUnitsFromMainLineup。
 */
async function getCityOnDutyDefenders(cityId, ownerFactionId) {
  let sql = `
     SELECT p.player_id, p.character_name, p.faction_id, p.faction_name,
            p.current_position_id, p.current_position_name, p.position_level,
            p.on_duty, p.on_duty_city_id,
            0 AS garrison_slot,
            'main_lineup' AS defense_source
     FROM players p
     INNER JOIN cities c ON c.id = ?
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
 * 获取某个城市的普通驻守防守者（on_duty=FALSE，按官职优先级排序）
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
 * 获取城市驻守统计（用于地图显示）
 */
async function getCityGarrisonStats() {
  const [rows] = await pool.query(
    `SELECT g.city_id, g.city_name,
            COUNT(DISTINCT g.player_id) AS player_count,
            COUNT(*) AS slot_count
     FROM player_garrison g
     JOIN players p ON g.player_id = p.player_id
     JOIN cities c ON c.id = g.city_id
     WHERE g.is_active = TRUE AND g.city_id IS NOT NULL
       AND c.faction_id IS NOT NULL AND p.faction_id = c.faction_id
     GROUP BY g.city_id, g.city_name
     ORDER BY slot_count DESC`
  );
  return rows;
}


/**
 * 从驻守配置构建战斗单位（用于异步PVE防守）
 * 只有兵力 >= MIN_TROOPS_TO_DEFEND 的部队才参战
 * 
 * @param {object} garrisonSlot - player_garrison 的一行
 * @returns {Array} 战斗单位数组，格式与 battlePlayerBuilder 一致
 */
async function buildDefenseUnits(garrisonSlot) {
  const units = [];
  const garrisonAttrBonusByChar = await getGarrisonSlotAttributeBonusByChar(pool, garrisonSlot);
  const charSlots = [
    { cardField: 'char1_card', troop1Field: 'char1_troop1', troop2Field: 'char1_troop2' },
    { cardField: 'char2_card', troop1Field: 'char2_troop1', troop2Field: 'char2_troop2' },
  ];

  for (const cs of charSlots) {
    const charInstanceId = garrisonSlot[cs.cardField];
    if (!charInstanceId) continue;

    // 读取将领卡实例 + 配置
    const [charRows] = await pool.query(
      `SELECT pc.instance_id, pc.card_id, pc.rarity, pc.morale,
              cc.character_name, cc.luck, cc.courage, cc.combat, cc.command,
              cc.intelligence, cc.politics, cc.charm, cc.trait, cc.trait_modifier,
              cc.skill_1, cc.skill_2, cc.troop_affinity
       FROM player_cards pc
       JOIN config_characters cc ON pc.card_id = cc.character_id
       WHERE pc.instance_id = ?`,
      [charInstanceId]
    );
    if (charRows.length === 0) continue;
    const charCfg = charRows[0];

    const charDataBase = {
      name: charCfg.character_name,
      courtesyName: charCfg.character_name,
      combat: charCfg.combat / 10,
      command: charCfg.command / 10,
      intelligence: charCfg.intelligence / 10,
      luck: charCfg.luck / 10,
      courage: charCfg.courage / 10,
      traitModifier: charCfg.trait_modifier || 0,
    };
    const charKey = cs.cardField === 'char1_card' ? 'char1' : 'char2';
    const charData = applyCharBonusToCharData(charDataBase, garrisonAttrBonusByChar[charKey] || {});

    // 读取该将领的部队卡（兵力 > 0 才参战，总兵力检查在 initiateSiege 中）
    const troopInstanceIds = [garrisonSlot[cs.troop1Field], garrisonSlot[cs.troop2Field]].filter(Boolean);
    for (const troopInstId of troopInstanceIds) {
      const [troopRows] = await pool.query(
        `SELECT pc.instance_id, pc.card_id, pc.rarity, pc.current_troops,
                pc.battle_count, pc.max_battle_count,
                pc.bonus_max_troops, pc.bonus_attack, pc.bonus_defense, pc.bonus_speed, pc.bonus_movement,
                ct.troop_name, ct.troop_type, ct.weapon_type, ct.attack, ct.defense,
                ct.speed, ct.movement, ct.\`range\`, ct.max_troops, ct.special_ability,
                ct.troop_weight
         FROM player_cards pc
         JOIN config_troops ct ON pc.card_id = ct.troop_id
         WHERE pc.instance_id = ?`,
        [troopInstId]
      );
      if (troopRows.length === 0) continue;
      const t = troopRows[0];

      const maxTroops = (t.max_troops || 0) + (t.bonus_max_troops || 0);
      const currentTroops = t.current_troops ?? maxTroops;
      if (currentTroops < MIN_TROOPS_TO_DEFEND) continue; // 兵力为0不参战

      units.push({
        troop: {
          id: t.card_id,
          instanceId: t.instance_id,
          name: t.troop_name,
          rarity: t.rarity || 'common',
          troopType: t.troop_type,
          weaponType: t.weapon_type,
          attack: (t.attack || 0) / 10 + (t.bonus_attack || 0) / 10,
          defense: (t.defense || 0) / 10 + (t.bonus_defense || 0) / 10,
          speed: (t.speed || 0) + (t.bonus_speed || 0),
          movement: (t.movement || 0) + (t.bonus_movement || 0),
          range: t.range || 1,
          maxTroops,
          troopWeight: t.troop_weight || 1,
          battleCount: t.battle_count ?? 0,
          maxBattleCount: t.max_battle_count ?? 60,
          skills: [],
        },
        character: charData,
        currentTroops,
        maxTroops,
        morale: charCfg.morale ?? 70,
        // 标记来源信息，战后用于更新
        _garrisonPlayerId: garrisonSlot.player_id,
        _garrisonSlot: garrisonSlot.garrison_slot,
      });
    }
  }

  return units;
}

/**
 * 从玩家「上阵编组」构建战斗单位（与 player_cards is_equipped 一致，与驻地编组无关）
 * @param {string} defenderPlayerId
 * @returns {Promise<Array>} 与 buildDefenseUnits 相同元素形状；_garrison_slot 固定为 0 表示非驻守槽（战后不刷 player_garrison 失活）
 */
async function buildDefenseUnitsFromMainLineup(defenderPlayerId) {
  const units = [];
  const attrBonusBySlot = await getMainLineupAttributeBonusBySlot(pool, defenderPlayerId);
  const [pRows] = await pool.query(
    `SELECT player_id, character_name, combat, command, intelligence, politics, charm, courage, luck, morale
     FROM players WHERE player_id = ?`,
    [defenderPlayerId]
  );
  const pRow = pRows[0];
  if (!pRow) return units;

  const pushUnit = (t, charData, charMorale) => {
    const maxTroops = (t.max_troops || 0) + (t.bonus_max_troops || 0);
    const currentTroops = t.current_troops ?? maxTroops;
    if (currentTroops < MIN_TROOPS_TO_DEFEND) return;
    units.push({
      troop: {
        id: t.card_id,
        instanceId: t.instance_id,
        name: t.troop_name,
        rarity: t.rarity || 'common',
        troopType: t.troop_type,
        weaponType: t.weapon_type,
        attack: (t.attack || 0) / 10 + (t.bonus_attack || 0) / 10,
        defense: (t.defense || 0) / 10 + (t.bonus_defense || 0) / 10,
        speed: (t.speed || 0) + (t.bonus_speed || 0),
        movement: (t.movement || 0) + (t.bonus_movement || 0),
        range: t.range || 1,
        maxTroops,
        troopWeight: t.troop_weight || 1,
        battleCount: t.battle_count ?? 0,
        maxBattleCount: t.max_battle_count ?? 60,
        skills: [],
      },
      character: charData,
      currentTroops,
      maxTroops,
      morale: charMorale ?? 70,
      _garrisonPlayerId: defenderPlayerId,
      _garrisonSlot: 0,
    });
  };

  // 主公 + 主公部队槽
  const [playerTroopRows] = await pool.query(
    `SELECT pc.instance_id, pc.card_id, pc.rarity, pc.current_troops,
            pc.battle_count, pc.max_battle_count,
            pc.bonus_max_troops, pc.bonus_attack, pc.bonus_defense, pc.bonus_speed, pc.bonus_movement,
            ct.troop_name, ct.troop_type, ct.weapon_type, ct.attack, ct.defense,
            ct.speed, ct.movement, ct.\`range\`, ct.max_troops, ct.special_ability,
            ct.troop_weight
     FROM player_cards pc
     JOIN config_troops ct ON pc.card_id = ct.troop_id
     WHERE pc.player_id = ? AND pc.is_equipped = TRUE
       AND pc.equipped_by = 'player' AND pc.equipped_slot = 'troop'`,
    [defenderPlayerId]
  );
  if (playerTroopRows.length > 0) {
    const t = playerTroopRows[0];
    const charDataBase = {
      name: pRow.character_name,
      courtesyName: pRow.character_name,
      combat: pRow.combat / 10,
      command: pRow.command / 10,
      intelligence: pRow.intelligence / 10,
      luck: pRow.luck / 10,
      courage: pRow.courage / 10,
      traitModifier: 0,
    };
    const charData = applyCharBonusToCharData(charDataBase, attrBonusBySlot.player || {});
    pushUnit(t, charData, pRow.morale ?? 70);
  }

  const charSlots = [
    { by: 'character1', troopSlots: ['troop1', 'troop2'] },
    { by: 'character2', troopSlots: ['troop1', 'troop2'] },
  ];
  for (const cs of charSlots) {
    const [charRows] = await pool.query(
      `SELECT pc.instance_id, pc.card_id, pc.rarity, pc.morale,
              cc.character_name, cc.luck, cc.courage, cc.combat, cc.command,
              cc.intelligence, cc.politics, cc.charm, cc.trait, cc.trait_modifier
       FROM player_cards pc
       JOIN config_characters cc ON pc.card_id = cc.character_id
       WHERE pc.player_id = ? AND pc.is_equipped = TRUE
         AND pc.card_type = 'character' AND pc.equipped_by = ? AND pc.equipped_slot = 'character'`,
      [defenderPlayerId, cs.by]
    );
    if (charRows.length === 0) continue;
    const charCfg = charRows[0];
    const charDataBase = {
      name: charCfg.character_name,
      courtesyName: charCfg.character_name,
      combat: charCfg.combat / 10,
      command: charCfg.command / 10,
      intelligence: charCfg.intelligence / 10,
      luck: charCfg.luck / 10,
      courage: charCfg.courage / 10,
      traitModifier: charCfg.trait_modifier || 0,
    };
    const charData = applyCharBonusToCharData(charDataBase, attrBonusBySlot[cs.by] || {});

    for (const slot of cs.troopSlots) {
      const [troopRows] = await pool.query(
        `SELECT pc.instance_id, pc.card_id, pc.rarity, pc.current_troops,
                pc.battle_count, pc.max_battle_count,
                pc.bonus_max_troops, pc.bonus_attack, pc.bonus_defense, pc.bonus_speed, pc.bonus_movement,
                ct.troop_name, ct.troop_type, ct.weapon_type, ct.attack, ct.defense,
                ct.speed, ct.movement, ct.\`range\`, ct.max_troops, ct.special_ability,
                ct.troop_weight
         FROM player_cards pc
         JOIN config_troops ct ON pc.card_id = ct.troop_id
         WHERE pc.player_id = ? AND pc.is_equipped = TRUE
           AND pc.card_type = 'troop' AND pc.equipped_by = ? AND pc.equipped_slot = ?`,
        [defenderPlayerId, cs.by, slot]
      );
      if (troopRows.length === 0) continue;
      pushUnit(troopRows[0], charData, charCfg.morale ?? 70);
    }
  }

  return units;
}

/**
 * 将 buildDefenseUnits / buildDefenseUnitsFromMainLineup 的输出转为攻城 API 前端的 npcGarrison 格式（与 cityService.initiateSiege 一致）
 */
/**
 * 披挂 PVP 服务端裁定：按推演终态写回攻城方「上阵编组」兵力，并全员部队卡 battle_count+1（对齐 POST /battles）
 * @param {string} playerId
 * @param {Array<object>} attackerSiegeNpcs mapBuiltUnitsToSiegeNpcFormat 结果
 * @param {Array<object>} attackerTroopsEnd runSiegePvpSkirmish.attackerTroopsEnd
 */
async function applyAuthoritativeSiegePvpAttackerLineupCasualties(playerId, attackerSiegeNpcs, attackerTroopsEnd) {
  if (!playerId || !Array.isArray(attackerSiegeNpcs) || !Array.isArray(attackerTroopsEnd)) return;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE player_cards 
       SET battle_count = LEAST(
         GREATEST(COALESCE(battle_count, 0), 0) + 1,
         COALESCE(max_battle_count, 60)
       )
       WHERE player_id = ? AND card_type = 'troop' AND is_equipped = TRUE`,
      [playerId],
    );
    for (let i = 0; i < attackerSiegeNpcs.length; i++) {
      const npc = attackerSiegeNpcs[i];
      const end = attackerTroopsEnd[i];
      if (!npc?._troopInstanceId || !end) continue;
      const maxT = Number(npc.maxTroops) || 9999;
      const cur = Math.max(0, Math.min(maxT, Math.round(Number(end.currentTroops) || 0)));
      await conn.query(
        `UPDATE player_cards SET current_troops = ?, last_troops_lost_at = ? WHERE instance_id = ? AND player_id = ?`,
        [cur, cur < maxT ? new Date() : null, npc._troopInstanceId, playerId],
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  await applyTroopDurabilityExhaustion((sql, params) => pool.query(sql, params), playerId);
}

function mapBuiltUnitsToSiegeNpcFormat(units) {
  if (!units || !Array.isArray(units)) return [];
  return units.map((u, i) => ({
    index: i,
    troopId: u.troop.id,
    troopName: u.troop.name,
    rarity: u.troop.rarity,
    troopType: u.troop.troopType,
    weaponType: u.troop.weaponType,
    attack: Math.round(u.troop.attack * 10),
    defense: Math.round(u.troop.defense * 10),
    speed: u.troop.speed,
    movement: u.troop.movement,
    attackRange: u.troop.range,
    maxTroops: u.troop.maxTroops,
    currentTroops: u.currentTroops,
    character: u.character
      ? {
          name: u.character.name,
          courtesyName: u.character.courtesyName || u.character.name,
          luck: Math.round(u.character.luck * 10),
          courage: Math.round(u.character.courage * 10),
          combat: Math.round(u.character.combat * 10),
          command: Math.round(u.character.command * 10),
          intelligence: Math.round(u.character.intelligence * 10),
          politics: 50,
          charm: 50,
          traitModifier: u.character.traitModifier || 0,
        }
      : null,
    alive: true,
    _isPlayerDefender: true,
    _garrisonPlayerId: u._garrisonPlayerId,
    _garrisonSlot: u._garrisonSlot,
    _troopInstanceId: u.troop.instanceId,
  }));
}

/**
 * 披挂上阵选择与城池/势力不一致、或缺少 on_duty_city_id（旧数据）时清除。
 * 与「驻地编组是否激活」无关；人数统计只看 on_duty + on_duty_city_id。
 */
async function clearInvalidOnDutySelection(playerId) {
  try {
    const [result] = await pool.query(
      `UPDATE players p
       LEFT JOIN cities c ON c.id = p.on_duty_city_id
       SET p.on_duty = FALSE, p.on_duty_city_id = NULL
       WHERE p.player_id = ?
         AND (p.on_duty = TRUE OR p.on_duty = 1)
         AND (
           p.on_duty_city_id IS NULL
           OR c.id IS NULL
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
  getMainLineupAttributeBonusBySlot,
  getGarrisonSlotAttributeBonusByChar,
  getPlayerGarrisons,
  getGarrisonSlot,
  saveGarrison,
  clearGarrison,
  stripGarrisonOnCityConquest,
  getCityDefenders,
  getCityOnDutyDefenders,
  getCityGarrisonDefenders,
  getCityGarrisonStats,
  buildDefenseUnits,
  buildDefenseUnitsFromMainLineup,
  applyAuthoritativeSiegePvpAttackerLineupCasualties,
  mapBuiltUnitsToSiegeNpcFormat,
  MIN_TROOPS_TO_DEFEND,
  MIN_GARRISON_TOTAL_TROOPS,
  MIN_MAIN_LINEUP_TROOPS_BATTLE,
  sumTroopInstancesTotalTroops,
  sumMainLineupEquippedTroopTroops,
  clearInvalidOnDutySelection,
};
