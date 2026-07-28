/**
 * 配置数据服务
 * 
 * @description 提供配置数据的业务逻辑处理
 * @module services/configService
 */

const db = require('../database/connection');

/**
 * config_troops 列表查询列（与 playerProfileService 编队读库一致）。
 * `range` 为 MySQL 保留字，显式 `` `range` AS troop_range ``，避免 SELECT * / 部分驱动下属性映射异常。
 */
const CONFIG_TROOPS_SELECT_COLUMNS = `
  troop_id, season, troop_name, rarity, troop_type, weapon_type, battle_unit_key,
  attack, defense, max_troops, troop_weight, speed, movement,
  \`range\` AS troop_range,
  special_ability, description
`.replace(/\s+/g, ' ').trim();

/**
 * 获取所有部队配置
 * @param {Object} filters - 过滤条件
 * @param {string} filters.season - 赛季ID
 * @param {string} filters.rarity - 稀有度
 * @param {string} filters.troopType - 兵种类型
 * @returns {Promise<Array>} 部队配置列表
 */
async function getTroops(filters = {}) {
  const { season, rarity, troopType } = filters;
  
  // 构建查询条件
  let query = `SELECT ${CONFIG_TROOPS_SELECT_COLUMNS} FROM config_troops WHERE 1=1`;
  const params = [];
  
  if (season) {
    query += ' AND season = ?';
    params.push(season);
  }
  
  if (rarity) {
    query += ' AND rarity = ?';
    params.push(rarity);
  }
  
  if (troopType) {
    query += ' AND troop_type = ?';
    params.push(troopType);
  }
  
  query += ' ORDER BY troop_id';
  
  const troops = await db.query(query, params);
  
  // 转换数据库字段名为前端使用的驼峰命名
  return troops.map(troop => formatTroopData(troop));
}

/**
 * 根据ID获取单个部队配置
 * @param {string} troopId - 部队ID
 * @returns {Promise<Object|null>} 部队配置对象
 */
async function getTroopById(troopId) {
  const troops = await db.query(
    `SELECT ${CONFIG_TROOPS_SELECT_COLUMNS} FROM config_troops WHERE troop_id = ?`,
    [troopId]
  );
  
  if (troops.length === 0) {
    return null;
  }
  
  return formatTroopData(troops[0]);
}

/**
 * 格式化部队数据
 * @param {Object} troop - 数据库部队记录
 * @returns {Object} 格式化后的部队数据
 */
/** 从 DB 行解析射程；未迁移库可能仍为 attack_range */
function parseTroopRangeFromRow(troop) {
  const raw = troop.troop_range ?? troop.range ?? troop.attack_range;
  const r = Number(raw);
  if (Number.isFinite(r) && r > 0) return r;
  return null;
}

function formatTroopData(troop) {
  // 解析special_ability JSON字段
  let specialAbility = {};
  if (troop.special_ability) {
    try {
      specialAbility = typeof troop.special_ability === 'string' 
        ? JSON.parse(troop.special_ability) 
        : troop.special_ability;
    } catch (e) {
      console.error('[configService] 解析special_ability失败:', e);
    }
  }
  
  // 从special_ability中提取counters
  const counters = specialAbility.counters || {};
  const adaptation = specialAbility.adaptation || {};
  const effects = specialAbility.effects || {};
  
  const battleUnitKeyRaw = troop.battle_unit_key;
  const battleUnitKey =
    battleUnitKeyRaw != null && String(battleUnitKeyRaw).trim()
      ? String(battleUnitKeyRaw).trim()
      : undefined;

  return {
    id: troop.troop_id,
    name: troop.troop_name,
    rarity: troop.rarity,
    troopType: troop.troop_type,
    season: troop.season,
    ...(battleUnitKey ? { battleUnitKey } : {}),
    
    // 基础属性
    maxTroops: troop.max_troops,
    troopWeight: troop.troop_weight || 1,
    range: parseTroopRangeFromRow(troop),
    attack: troop.attack / 10,  // 数据库×10存储，需要除以10
    defense: troop.defense / 10,  // 数据库×10存储，需要除以10
    speed: troop.speed,
    movement: troop.movement,
    
    // 从special_ability中提取字段
    weaponType: troop.weapon_type || specialAbility.weapon_type || '',
    skills: specialAbility.skills || [],
    
    // 克制关系
    infantryCounter: counters.infantry || 1,
    cavalryCounter: counters.cavalry || 1,
    archerCounter: counters.archer || 1,
    siegeCounter: counters.siege || 1,
    
    // 地形适应
    plainAdapt: adaptation.plain || 1,
    hillAdapt: adaptation.hill || 1,
    forestAdapt: adaptation.forest || 1,
    siegeAdapt: adaptation.siege || 1,
    
    // 特效（空值=CSS默认效果，填写值=动画模组ID）
    attackEffect: effects.attack || '',
    
    // 描述
    description: troop.description || '尚无记载',
  };
}

/**
 * 获取所有将领配置
 * @param {Object} filters - 过滤条件
 * @param {string} filters.season - 赛季ID
 * @param {string} filters.rarity - 稀有度
 * @param {string} filters.faction - 势力
 * @param {string} filters.characterType - 将领类型
 * @param {string} filters.stage - 生涯
 * @returns {Promise<Array>} 将领配置列表
 */
async function getCharacters(filters = {}) {
  const { season, rarity, faction, characterType, stage } = filters;
  
  // 构建查询条件
  let query = 'SELECT * FROM config_characters WHERE 1=1';
  const params = [];
  
  if (season) {
    query += ' AND season = ?';
    params.push(season);
  }
  
  if (rarity) {
    query += ' AND rarity = ?';
    params.push(rarity);
  }
  
  if (faction) {
    query += ' AND faction = ?';
    params.push(faction);
  }
  
  if (characterType) {
    query += ' AND character_type = ?';
    params.push(characterType);
  }
  
  if (stage) {
    query += ' AND stage = ?';
    params.push(stage);
  }
  
  query += ' ORDER BY character_id';
  
  const characters = await db.query(query, params);
  
  // 转换数据库字段名为前端使用的驼峰命名
  return characters.map(char => formatCharacterData(char));
}

/**
 * 根据ID获取单个将领配置
 * @param {string} characterId - 将领ID
 * @returns {Promise<Object|null>} 将领配置对象
 */
async function getCharacterById(characterId) {
  const characters = await db.query(
    'SELECT * FROM config_characters WHERE character_id = ?',
    [characterId]
  );
  
  if (characters.length === 0) {
    return null;
  }
  
  return formatCharacterData(characters[0]);
}

/**
 * 格式化将领数据
 * @param {Object} char - 数据库将领记录
 * @returns {Object} 格式化后的将领数据
 */
function formatCharacterData(char) {
  // 解析character_extra JSON字段
  let characterExtra = {};
  if (char.character_extra) {
    try {
      characterExtra = typeof char.character_extra === 'string' 
        ? JSON.parse(char.character_extra) 
        : char.character_extra;
    } catch (e) {
      console.error('[configService] 解析character_extra失败:', e);
    }
  }
  
  return {
    id: char.character_id,
    name: char.character_name,
    courtesyName: char.courtesy_name || '',
    rarity: char.rarity,
    gender: char.gender === 'female' ? 'female' : 'male',
    faction: char.faction || '',
    season: char.season,
    
    // 生平信息
    birthYear: char.birth_year,
    deathYear: char.death_year,
    stage: char.stage,
    
    // 将领类型
    characterType: char.character_type,
    
    // 属性（数据库×10存储，需要除以10）
    luck: char.luck / 10,
    courage: char.courage / 10,
    combat: char.combat / 10,
    command: char.command / 10,
    intelligence: char.intelligence / 10,
    politics: char.politics / 10,
    charm: char.charm / 10,
    
    // 技能
    skill_1: char.skill_1,
    skill_2: char.skill_2,
    skills: [char.skill_1, char.skill_2].filter(s => s),
    
    // 其他核心属性
    troopAffinity: char.troop_affinity,
    trait: char.trait,
    traitModifier: char.trait_modifier,
    
    // 从character_extra中提取字段
    bonds: characterExtra.bonds || [],
    biography: characterExtra.biography || '',
    description: characterExtra.description || '',
  };
}

/**
 * 获取所有装备件配置
 * @param {Object} filters - { season, equipmentType, rarity }
 * @returns {Promise<Array>}
 */
async function getEquipment(filters = {}) {
  const { season, equipmentType, rarity } = filters;

  let query  = 'SELECT * FROM config_equipment WHERE 1=1';
  const params = [];

  if (season) {
    query += ' AND season = ?';
    params.push(season);
  }

  // equipment_type 和 rarity 从 ID 解析（§12：…_equip_{1-3}_{稀有1位}{序号3位}）；LIKE 中 _ 为通配符，改用 REGEXP
  const typeNumMap   = { weapon: '1', armor: '2', accessory: '3' };
  const rarityNumMap = { common: '1', rare: '2', epic: '3', legendary: '4', core: '5' };

  if (equipmentType && typeNumMap[equipmentType]) {
    query += ` AND equipment_id REGEXP ?`;
    params.push(`_equip_${typeNumMap[equipmentType]}_[0-9]`);
  }

  if (rarity && rarityNumMap[rarity]) {
    query += ` AND equipment_id REGEXP ?`;
    params.push(`_equip_[1-3]_${rarityNumMap[rarity]}[0-9]{3}$`);
  }

  query += ' ORDER BY equipment_id';

  const rows = await db.query(query, params);
  return rows.map(formatEquipmentData);
}

/**
 * 根据ID获取单个装备件配置
 */
async function getEquipmentById(equipmentId) {
  const rows = await db.query(
    'SELECT * FROM config_equipment WHERE equipment_id = ?',
    [equipmentId]
  );
  if (rows.length === 0) return null;
  return formatEquipmentData(rows[0]);
}

/**
 * 获取宝物配置
 * @param {Object} filters - { season, series, rarity }
 */
async function getTreasures(filters = {}) {
  const { season, series, rarity } = filters;

  let query = 'SELECT * FROM config_treasures WHERE 1=1';
  const params = [];

  if (season) {
    query += ' AND season = ?';
    params.push(season);
  }
  if (series) {
    query += ' AND series = ?';
    params.push(series);
  }

  const rarityNumMap = { common: '1', rare: '2', epic: '3', legendary: '4', core: '5' };
  if (rarity && rarityNumMap[rarity]) {
    query += ' AND treasure_id REGEXP ?';
    params.push(`_treasure_${rarityNumMap[rarity]}[0-9]{3}$`);
  }

  query += ' ORDER BY treasure_id';
  const rows = await db.query(query, params);
  return rows.map(formatTreasureData);
}

async function getTreasureById(treasureId) {
  const rows = await db.query(
    'SELECT * FROM config_treasures WHERE treasure_id = ?',
    [treasureId],
  );
  if (rows.length === 0) return null;
  return formatTreasureData(rows[0]);
}

/**
 * 获取事件配置
 * @param {Object} filters - { location, triggerContext }
 * @returns {Promise<Array>}
 */
async function getEvents(filters = {}) {
  const { location, triggerContext } = filters;

  let query  = 'SELECT * FROM config_events WHERE 1=1';
  const params = [];

  if (location) {
    query += ' AND location = ?';
    params.push(location);
  }

  if (triggerContext) {
    query += ' AND trigger_context = ?';
    params.push(triggerContext);
  }

  query += ' ORDER BY event_id';

  const rows = await db.query(query, params);
  return rows.map(formatEventData);
}

/**
 * 根据ID获取单个事件配置
 */
async function getEventById(eventId) {
  const rows = await db.query(
    'SELECT * FROM config_events WHERE event_id = ?',
    [eventId]
  );
  if (rows.length === 0) return null;
  return formatEventData(rows[0]);
}

/**
 * `trigger_probability`：仅 **1** 表示与同池其他「必出」事件争位；**NULL/非 1** 在 API 中一律输出 `null`（与同 location 池内事件 **均等** 随机，见前端 `pickRandomEvent`）。
 */
function formatTriggerProbability(row) {
  const v = row.trigger_probability;
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && !String(v).trim()) return null;
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return null;
  if (n === 1) return 1;
  return null;
}

/**
 * 格式化事件数据（数据库 → 前端）
 * 
 * 规则：不做字段名转换，直接返回数据库字段名
 * - 顶层字段：snake_case（与DB一致）
 * - option_a / option_b：JSON 解析后原样返回（camelCase，与DB存储一致）
 */
function formatEventData(row) {
  // 解析 option JSON 字段
  const parseJson = (val) => {
    if (!val) return null;
    try {
      return typeof val === 'string' ? JSON.parse(val) : val;
    } catch { return null; }
  };

  const formatted = {
    event_id:            row.event_id,
    event_name:          row.event_name,
    event_hint:          row.event_hint || null,
    location:            row.location || null,
    min_reputation: (() => {
      if (row.min_reputation == null || row.min_reputation === '') return null;
      const n = Number(row.min_reputation);
      return Number.isFinite(n) ? n : null;
    })(),
    trigger_probability: formatTriggerProbability(row),
    trigger_context:     row.trigger_context || null,
    chain_id:            row.chain_id || null,
    chain_level:         row.chain_level || null,
    required_items:      row.required_items || null,
    description_1:       row.description_1 || null,
    description_2:       row.description_2 || null,
    description_3:       row.description_3 || null,
    option_a:            parseJson(row.option_a),
    option_b:            parseJson(row.option_b),
  };

  // 事件级 required_items（事件链道具）合并到两个选项的 requiredItems
  if (formatted.required_items) {
    const eventItems = formatted.required_items;
    if (formatted.option_a) {
      const optA = formatted.option_a.requiredItems;
      formatted.option_a.requiredItems = optA ? `${eventItems};${optA}` : eventItems;
    }
    if (formatted.option_b) {
      const optB = formatted.option_b.requiredItems;
      formatted.option_b.requiredItems = optB ? `${eventItems};${optB}` : eventItems;
    }
  }

  return formatted;
}

/**
 * 格式化装备件数据（数据库 → 前端）
 */
function formatEquipmentData(row) {
  // 解析 ID 获取 equipmentType 和 rarity
  const match = (row.equipment_id || '').match(/^(san_\d+)_equip_(\d)_(\d)\d+$/);
  const typeMap   = { '1': 'weapon', '2': 'armor', '3': 'accessory' };
  const rarityMap = { '1': 'common', '2': 'rare', '3': 'epic', '4': 'legendary', '5': 'core' };

  const equipmentType = match ? (typeMap[match[2]]   || 'weapon')  : 'weapon';
  const rarity        = match ? (rarityMap[match[3]] || 'common') : 'common';

  // 将各 bonus 字段组装为数组（只保留非零项）
  const bonusKeyMap = {
    luck_bonus:         'luck',
    courage_bonus:      'courage',
    combat_bonus:       'combat',
    command_bonus:      'command',
    intelligence_bonus: 'intelligence',
    politics_bonus:     'politics',
    charm_bonus:        'charm',
  };

  const bonus = [];
  for (const [field, key] of Object.entries(bonusKeyMap)) {
    const val = row[field];
    if (val && val !== 0) {
      bonus.push({ key, value: val / 10 }); // ÷10 还原显示值
    }
  }

  // 解析 special_effect JSON
  let specialEffect = null;
  if (row.special_effect) {
    try {
      const parsed = typeof row.special_effect === 'string'
        ? JSON.parse(row.special_effect)
        : row.special_effect;
      // 如果是 {raw: "..."} 格式，取原始字符串
      specialEffect = parsed.raw || JSON.stringify(parsed);
    } catch (e) {
      specialEffect = String(row.special_effect);
    }
  }

  return {
    id:                row.equipment_id,
    name:              row.equipment_name,
    season:            row.season,
    equipmentType,
    rarity,
    bonus,
    specialEffect,
    specialEffectDesc: row.special_effect_desc || null,
    description:       row.description || '',
  };
}

/**
 * 格式化宝物数据（数据库 → 前端）
 */
function formatTreasureData(row) {
  const match = (row.treasure_id || '').match(/^(san_\d+)_treasure_(\d)\d{3}$/);
  const rarityMap = { '1': 'common', '2': 'rare', '3': 'epic', '4': 'legendary', '5': 'core' };
  const rarity = match ? (rarityMap[match[2]] || 'common') : 'common';

  const bonusKeyMap = {
    luck_bonus: 'luck',
    courage_bonus: 'courage',
    combat_bonus: 'combat',
    command_bonus: 'command',
    intelligence_bonus: 'intelligence',
    politics_bonus: 'politics',
    charm_bonus: 'charm',
  };

  const bonus = [];
  const attributeBonus = {};
  for (const [field, key] of Object.entries(bonusKeyMap)) {
    const val = row[field];
    if (val && val !== 0) {
      bonus.push({ key, value: val / 10 });
      attributeBonus[key] = val;
    }
  }

  let specialEffect = null;
  if (row.special_effect) {
    try {
      const parsed = typeof row.special_effect === 'string'
        ? JSON.parse(row.special_effect)
        : row.special_effect;
      specialEffect = parsed.raw || JSON.stringify(parsed);
    } catch (e) {
      specialEffect = String(row.special_effect);
    }
  }

  return {
    id: row.treasure_id,
    name: row.treasure_name,
    season: row.season,
    series: row.series || null,
    rarity,
    bonus,
    attributeBonus,
    specialEffect,
    specialEffectDesc: row.special_effect_desc || null,
    description: row.description || '',
  };
}

module.exports = {
  CONFIG_TROOPS_SELECT_COLUMNS,
  getTroops,
  getTroopById,
  formatTroopData,
  getCharacters,
  getCharacterById,
  getEquipment,
  getEquipmentById,
  getTreasures,
  getTreasureById,
  formatTreasureData,
  getEvents,
  getEventById,
};
