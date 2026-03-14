/**
 * 导入配置数据到MySQL数据库
 * 将领、部队、官职、势力配置数据导入
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: '05_san_storm',
  charset: 'utf8mb4'
};

// 数据文件路径
const DATA_DIR = path.join(__dirname, '../../public/data/shared');

/**
 * 从ID中提取赛季信息
 * @param {string} id - 配置ID（如：san_1_char_1001）
 * @returns {string} - 赛季ID（如：san_1）
 */
function extractSeason(id) {
  // 从 "san_1_char_1001" 提取 "san_1"
  const match = id.match(/^(san_\d+)/);
  return match ? match[1] : null;
}

/**
 * 导入将领配置数据
 */
async function importCharacters(connection) {
  console.log('开始导入将领配置数据...');
  
  const filePath = path.join(DATA_DIR, 'characters.json');
  const fileContent = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(fileContent);
  
  let imported = 0;
  let skipped = 0;
  
  for (const char of data.characters) {
    try {
      // 从ID中提取赛季信息
      const season = extractSeason(char.id);
      
      if (!season) {
        console.error(`无法提取赛季信息: ${char.id}`);
        skipped++;
        continue;
      }
      
      // 构建character_extra JSON对象（移除morale和trait_modifier）
      const characterExtra = {
        bonds: char.bonds || [],
        biography: char.biography || '',
        description: char.description || ''
      };
      
      // 将属性值×10存储（符合数据库设计规范）
      await connection.query(`
        INSERT INTO config_characters (
          character_id, season, character_name, courtesy_name, rarity, faction,
          luck, courage, combat, command, intelligence, politics, charm,
          birth_year, death_year, stage, character_type,
          skill_1, skill_2, troop_affinity, trait, trait_modifier, character_extra
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          season = VALUES(season),
          character_name = VALUES(character_name),
          courtesy_name = VALUES(courtesy_name),
          rarity = VALUES(rarity),
          faction = VALUES(faction),
          luck = VALUES(luck),
          courage = VALUES(courage),
          combat = VALUES(combat),
          command = VALUES(command),
          intelligence = VALUES(intelligence),
          politics = VALUES(politics),
          charm = VALUES(charm),
          birth_year = VALUES(birth_year),
          death_year = VALUES(death_year),
          stage = VALUES(stage),
          character_type = VALUES(character_type),
          skill_1 = VALUES(skill_1),
          skill_2 = VALUES(skill_2),
          troop_affinity = VALUES(troop_affinity),
          trait = VALUES(trait),
          trait_modifier = VALUES(trait_modifier),
          character_extra = VALUES(character_extra)
      `, [
        char.id,
        season,
        char.name,
        char.courtesyName || null,
        char.rarity,
        char.faction || null,
        Math.round(char.luck * 10),        // 运气×10
        Math.round(char.courage * 10),     // 勇气×10
        Math.round(char.combat * 10),      // 武力×10
        Math.round(char.command * 10),     // 统帅×10
        Math.round(char.intelligence * 10), // 智力×10
        Math.round(char.politics * 10),    // 政治×10
        Math.round(char.charm * 10),       // 魅力×10
        char.birthYear || null,
        char.deathYear || null,
        char.stage || null,
        char.characterType || null,
        char.skill_1 || null,
        char.skill_2 || null,
        char.troopAffinity || null,
        char.trait || null,
        char.trait_modifier || 0,           // 特性修正值（使用下划线命名）
        JSON.stringify(characterExtra)
      ]);
      imported++;
    } catch (error) {
      console.error(`导入将领 ${char.name} 失败:`, error.message);
      skipped++;
    }
  }
  
  console.log(`✅ 将领配置导入完成: ${imported} 成功, ${skipped} 跳过`);
}

/**
 * 导入部队配置数据
 */
async function importTroops(connection) {
  console.log('开始导入部队配置数据...');
  
  const filePath = path.join(DATA_DIR, 'troops.json');
  const fileContent = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(fileContent);
  
  let imported = 0;
  let skipped = 0;
  
  for (const troop of data.troops) {
    try {
      // 从ID中提取赛季信息
      const season = extractSeason(troop.id);
      
      if (!season) {
        console.error(`无法提取赛季信息: ${troop.id}`);
        skipped++;
        continue;
      }
      
      // 构建special_ability JSON对象（包含武器、克制、适应、技能、特效）
      const specialAbility = {
        weapon_type: troop.weaponType || null,
        counters: {
          infantry: troop.infantryCounter || 1.0,
          cavalry: troop.cavalryCounter || 1.0,
          archer: troop.archerCounter || 1.0,
          siege: troop.siegeCounter || 1.0
        },
        adaptation: {
          plain: troop.plainAdapt || 1.0,
          hill: troop.hillAdapt || 1.0,
          forest: troop.forestAdapt || 1.0,
          siege: troop.siegeAdapt || 1.0
        },
        skills: troop.skills || [],
        effects: {
          attack: troop.attackEffect || null,
          projectile: troop.projectileSprite || null,
          hit: troop.hitEffect || null
        }
      };
      
      // 将攻击和防御×10存储（符合数据库设计规范）
      await connection.query(`
        INSERT INTO config_troops (
          troop_id, season, troop_name, rarity, troop_type,
          attack, defense, max_troops, speed, movement, \`range\`,
          special_ability, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          season = VALUES(season),
          troop_name = VALUES(troop_name),
          rarity = VALUES(rarity),
          troop_type = VALUES(troop_type),
          attack = VALUES(attack),
          defense = VALUES(defense),
          max_troops = VALUES(max_troops),
          speed = VALUES(speed),
          movement = VALUES(movement),
          \`range\` = VALUES(\`range\`),
          special_ability = VALUES(special_ability),
          description = VALUES(description)
      `, [
        troop.id,
        season,
        troop.name,
        troop.rarity,
        troop.troopType,
        Math.round(troop.attack * 10),  // 攻击×10
        Math.round(troop.defense * 10), // 防御×10
        troop.maxTroops,
        troop.speed,
        troop.movement,
        troop.range,
        JSON.stringify(specialAbility),
        troop.description || null
      ]);
      imported++;
    } catch (error) {
      console.error(`导入部队 ${troop.name} 失败:`, error.message);
      skipped++;
    }
  }
  
  console.log(`✅ 部队配置导入完成: ${imported} 成功, ${skipped} 跳过`);
}

/**
 * 导入官职配置数据
 */
async function importPositions(connection) {
  console.log('开始导入官职配置数据...');
  
  const filePath = path.join(DATA_DIR, 'positions.json');
  const fileContent = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(fileContent);
  
  let imported = 0;
  let skipped = 0;
  
  for (const position of data.positions) {
    try {
      // 从ID中提取赛季信息
      const season = extractSeason(position.id);
      
      if (!season) {
        console.error(`无法提取赛季信息: ${position.id}`);
        skipped++;
        continue;
      }
      
      // 构建position_bonuses JSON对象
      const positionBonuses = {
        resource: position.bonuses?.resourceBonus || 0,
        prestige: position.bonuses?.prestigeBonus || 0,
        infantry: position.bonuses?.infantryBonus || 0,
        cavalry: position.bonuses?.cavalryBonus || 0,
        archer: position.bonuses?.archerBonus || 0
      };
      
      await connection.query(`
        INSERT INTO config_positions (
          position_id, season, position_name, position_level, position_rank, category,
          icon, color, description,
          requirement, position_bonuses,
          permissions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          season = VALUES(season),
          position_name = VALUES(position_name),
          position_level = VALUES(position_level),
          position_rank = VALUES(position_rank),
          category = VALUES(category),
          icon = VALUES(icon),
          color = VALUES(color),
          description = VALUES(description),
          requirement = VALUES(requirement),
          position_bonuses = VALUES(position_bonuses),
          permissions = VALUES(permissions)
      `, [
        position.id,
        season,
        position.name,
        position.level,
        position.rank || 0,
        position.rarity || 'common',
        position.icon || null,
        position.color || null,
        position.description || null,
        position.requirement === 'AI' || position.requirement === '待定' ? 0 : parseInt(position.requirement) || 0,
        JSON.stringify(positionBonuses),
        JSON.stringify(position.permissions || [])
      ]);
      imported++;
    } catch (error) {
      console.error(`导入官职 ${position.name} 失败:`, error.message);
      skipped++;
    }
  }
  
  console.log(`✅ 官职配置导入完成: ${imported} 成功, ${skipped} 跳过`);
}

/**
 * 导入势力配置数据
 */
async function importFactions(connection) {
  console.log('开始导入势力配置数据...');
  
  const filePath = path.join(__dirname, '../../public/data/shared/factions.json');
  const fileContent = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(fileContent);
  
  let imported = 0;
  let skipped = 0;
  
  for (const faction of data.factions) {
    try {
      // 从ID中提取赛季信息
      const seasonId = extractSeason(faction.id);
      
      if (!seasonId) {
        console.error(`无法提取赛季信息: ${faction.id}`);
        skipped++;
        continue;
      }
      
      await connection.query(`
        INSERT INTO config_factions (
          faction_id, season, faction_name, faction_leader,
          icon, color, style, max_players,
          faction_bonuses, description, difficulty
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          season = VALUES(season),
          faction_name = VALUES(faction_name),
          faction_leader = VALUES(faction_leader),
          icon = VALUES(icon),
          color = VALUES(color),
          style = VALUES(style),
          max_players = VALUES(max_players),
          faction_bonuses = VALUES(faction_bonuses),
          description = VALUES(description),
          difficulty = VALUES(difficulty)
      `, [
        faction.id,
        seasonId,
        faction.name,
        faction.leader || null,
        faction.icon || null,
        faction.color || null,
        faction.style || null,
        faction.max_players,
        JSON.stringify(faction.bonuses || []),
        faction.description || null,
        faction.difficulty || '中级'
      ]);
      imported++;
    } catch (error) {
      console.error(`导入势力 ${faction.name} 失败:`, error.message);
      skipped++;
    }
  }
  
  console.log(`✅ 势力配置导入完成: ${imported} 成功, ${skipped} 跳过`);
}

/**
 * 主函数
 */
async function main() {
  let connection;
  
  try {
    console.log('连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 导入将领配置
    await importCharacters(connection);
    console.log('');
    
    // 导入部队配置
    await importTroops(connection);
    console.log('');
    
    // 导入官职配置
    await importPositions(connection);
    console.log('');
    
    // 导入势力配置
    await importFactions(connection);
    console.log('');
    
    console.log('🎉 所有配置数据导入完成！');
    
  } catch (error) {
    console.error('❌ 导入失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 执行导入
main();
