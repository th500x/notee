/**
 * 导入技能和羁绊配置数据到MySQL数据库
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 数据库配置（优先使用.env，兼容本地开发默认值）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '05_san_storm',
  charset: 'utf8mb4'
};

// 数据文件路径
const DATA_DIR = path.join(__dirname, '../../public/data/shared');

/**
 * 从ID中提取赛季信息
 */
function extractSeason(id) {
  const match = id.match(/^(san_\d+)/);
  return match ? match[1] : null;
}

/**
 * 导入技能配置数据
 */
async function importSkills(connection) {
  console.log('开始导入技能配置数据...');
  
  const filePath = path.join(DATA_DIR, 'skills.json');
  const fileContent = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(fileContent);
  const skills = data.skills || data;
  
  let imported = 0;
  let skipped = 0;
  
  for (const skill of skills) {
    try {
      await connection.query(`
        INSERT INTO config_skills (
          skill_id, season, skill_name, skill_type, rarity,
          damage_type, character_type, troop_type,
          target_effect, target_range, target_count, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          season = VALUES(season),
          skill_name = VALUES(skill_name),
          skill_type = VALUES(skill_type),
          rarity = VALUES(rarity),
          damage_type = VALUES(damage_type),
          character_type = VALUES(character_type),
          troop_type = VALUES(troop_type),
          target_effect = VALUES(target_effect),
          target_range = VALUES(target_range),
          target_count = VALUES(target_count),
          description = VALUES(description)
      `, [
        skill.id,
        extractSeason(skill.id) || 'san_1',
        skill.name,
        skill.type,
        skill.rarity,
        skill.damageType || null,
        skill.characterType || null,
        skill.troopType || null,
        skill.targetEffect || null,
        skill.targetRange || null,
        skill.targetCount || null,
        skill.description || null
      ]);
      imported++;
    } catch (error) {
      console.error(`导入技能 ${skill.name} 失败:`, error.message);
      skipped++;
    }
  }
  
  console.log(`✅ 技能配置导入完成: ${imported} 成功, ${skipped} 跳过`);
}

/**
 * 导入羁绊配置数据
 */
async function importBonds(connection) {
  console.log('开始导入羁绊配置数据...');
  
  const filePath = path.join(DATA_DIR, 'bonds.json');
  const fileContent = await fs.readFile(filePath, 'utf8');
  const bonds = JSON.parse(fileContent);
  
  let imported = 0;
  let skipped = 0;
  
  for (const bond of bonds) {
    try {
      await connection.query(`
        INSERT INTO config_bonds (
          bond_id, bond_name, bond_type, rarity,
          min_characters,
          target_effect, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          bond_name = VALUES(bond_name),
          bond_type = VALUES(bond_type),
          rarity = VALUES(rarity),
          min_characters = VALUES(min_characters),
          target_effect = VALUES(target_effect),
          description = VALUES(description)
      `, [
        bond.id,
        bond.name,
        bond.type,
        bond.rarity,
        bond.minCharacters || 2,
        bond.targetEffect || null,
        bond.description || null
      ]);
      imported++;
    } catch (error) {
      console.error(`导入羁绊 ${bond.name} 失败:`, error.message);
      skipped++;
    }
  }
  
  console.log(`✅ 羁绊配置导入完成: ${imported} 成功, ${skipped} 跳过`);
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
    
    // 导入技能配置
    await importSkills(connection);
    console.log('');
    
    // 导入羁绊配置
    await importBonds(connection);
    console.log('');
    
    console.log('🎉 技能和羁绊配置数据导入完成！');
    
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

