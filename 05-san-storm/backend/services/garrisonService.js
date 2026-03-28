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

  return { success: true };
}

/**
 * 清空驻守槽位
 */
async function clearGarrison(playerId, slotNumber) {
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
 */
async function getCityDefenders(cityId) {
  const [rows] = await pool.query(
    `SELECT g.*, p.character_name, p.faction_id, p.faction_name,
            p.current_position_id, p.current_position_name, p.position_level
     FROM player_garrison g
     JOIN players p ON g.player_id = p.player_id
     WHERE g.city_id = ? AND g.is_active = TRUE
     ORDER BY p.position_level ASC, g.garrison_slot ASC`,
    [cityId]
  );
  return rows;
}

/**
 * 获取城市驻守统计（用于地图显示）
 */
async function getCityGarrisonStats() {
  const [rows] = await pool.query(
    `SELECT city_id, city_name,
            COUNT(DISTINCT player_id) AS player_count,
            COUNT(*) AS slot_count
     FROM player_garrison
     WHERE is_active = TRUE AND city_id IS NOT NULL
     GROUP BY city_id, city_name
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
          maxBattleCount: t.max_battle_count ?? 25,
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
  getCityGarrisonStats,
  buildDefenseUnits,
  MIN_TROOPS_TO_DEFEND,
};
