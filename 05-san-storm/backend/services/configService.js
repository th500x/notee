/**
 * 配置数据服务
 * 
 * @description 提供配置数据的业务逻辑处理
 * @module services/configService
 */

const db = require('../database/connection');

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
  let query = 'SELECT * FROM config_troops WHERE 1=1';
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
    'SELECT * FROM config_troops WHERE troop_id = ?',
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
  
  return {
    id: troop.troop_id,
    name: troop.troop_name,
    rarity: troop.rarity,
    troopType: troop.troop_type,
    season: troop.season,
    
    // 基础属性
    maxTroops: troop.max_troops,
    range: troop.range,
    attack: troop.attack / 10,  // 数据库×10存储，需要除以10
    defense: troop.defense / 10,  // 数据库×10存储，需要除以10
    speed: troop.speed,
    movement: troop.movement,
    
    // 从special_ability中提取字段
    weaponType: specialAbility.weapon_type || '',
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
    
    // 特效
    attackEffect: effects.attack || '',
    projectileSprite: effects.projectile || '',
    hitEffect: effects.hit || '',
    
    // 描述
    description: troop.description || '尚无记载',
    
    // 元数据
    version: troop.version
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
    
    // 元数据
    version: char.version
  };
}

module.exports = {
  getTroops,
  getTroopById,
  getCharacters,
  getCharacterById
};
