/**
 * 驻守服务 - 驻守配置CRUD、城市防守者查询、防守单位构建
 * 
 * @module backend/services/garrisonService
 */

const { pool } = require('../database/connection');

// 驻守槽位中所有卡牌字段
const CARD_FIELDS = [
  'char1_card', 'char1_equipment_card', 'char1_title', 'char1_achievement', 'char1_treasure', 'char1_troop1', 'char1_troop2',
  'char2_card', 'char2_equipment_card', 'char2_title', 'char2_achievement', 'char2_treasure', 'char2_troop1', 'char2_troop2',
];

// 单部队参战最低兵力（兵力为0不参战，总兵力检查在 initiateSiege 中 ≥ 800）
const MIN_TROOPS_TO_DEFEND = 1;

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
  const instanceIds = CARD_FIELDS.map(f => config[f]).filter(Boolean);

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

  const garrisonTroopFields = ['char1_troop1', 'char1_troop2', 'char2_troop1', 'char2_troop2'];
  const prevSlot = await getGarrisonSlot(playerId, slotNumber);
  const newlyAssignedTroopIds = [...new Set(
    garrisonTroopFields
      .map((f) => {
        const nextId = config[f] || null;
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

  const hasChar = !!(config.char1_card || config.char2_card);
  const hasTroop = !!(config.char1_troop1 || config.char1_troop2 || config.char2_troop1 || config.char2_troop2);
  const isActive = hasChar && hasTroop;

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
      playerId, slotNumber, config.cityId || null, config.cityName || null,
      config.char1_card || null, config.char1_equipment_card || null,
      config.char1_title || null, config.char1_achievement || null, config.char1_treasure || null,
      config.char1_troop1 || null, config.char1_troop2 || null,
      config.char2_card || null, config.char2_equipment_card || null,
      config.char2_title || null, config.char2_achievement || null, config.char2_treasure || null,
      config.char2_troop1 || null, config.char2_troop2 || null,
      isActive,
    ]
  );

  // ── 重算驻守部队卡的特效加成（复用上阵编组的 applyCardBonusToTroops 逻辑） ──
  // 对 char1 和 char2 各自：先清零部队卡 bonus，再累加所有特效卡的 special_effect
  for (const charKey of ['char1', 'char2']) {
    const troopIds = [config[`${charKey}_troop1`], config[`${charKey}_troop2`]].filter(Boolean);
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
      config[`${charKey}_title`],
      config[`${charKey}_achievement`],
      config[`${charKey}_treasure`],
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

  return { success: true };
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
 * 获取某个城市的披挂上阵防守者（on_duty=TRUE，按官职优先级排序）
 */
async function getCityOnDutyDefenders(cityId, ownerFactionId) {
  let sql = `
     SELECT g.*, p.character_name, p.faction_id, p.faction_name,
            p.current_position_id, p.current_position_name, p.position_level,
            p.on_duty
     FROM player_garrison g
     JOIN players p ON g.player_id = p.player_id
     WHERE g.city_id = ? AND g.is_active = TRUE AND p.on_duty = TRUE`;
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

    const charData = {
      name: charCfg.character_name,
      courtesyName: charCfg.character_name,
      combat: charCfg.combat / 10,
      command: charCfg.command / 10,
      intelligence: charCfg.intelligence / 10,
      luck: charCfg.luck / 10,
      courage: charCfg.courage / 10,
      traitModifier: charCfg.trait_modifier || 0,
    };

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

module.exports = {
  getPlayerGarrisons,
  getGarrisonSlot,
  saveGarrison,
  clearGarrison,
  getCityDefenders,
  getCityOnDutyDefenders,
  getCityGarrisonDefenders,
  getCityGarrisonStats,
  buildDefenseUnits,
  MIN_TROOPS_TO_DEFEND,
};
