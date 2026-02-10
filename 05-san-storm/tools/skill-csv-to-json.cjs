#!/usr/bin/env node

/**
 * 技能CSV转JSON工具
 * 
 * 功能：
 * 1. 读取 skill-template.csv
 * 2. 解析技能ID，提取类型和稀有度
 * 3. 生成 skills.json
 * 
 * 使用方法：
 * node tools/skill-csv-to-json.cjs
 */

const fs = require('fs');
const path = require('path');

// 文件路径
const CSV_PATH = path.join(__dirname, 'skill-template.csv');
const JSON_PATH = path.join(__dirname, '../public/data/shared/skills.json');

// 稀有度映射
const RARITY_MAP = {
  '5': 'core',
  '4': 'legendary',
  '3': 'epic',
  '2': 'rare',
  '1': 'common'
};

// 稀有度中文名
const RARITY_NAMES = {
  'core': '核心',
  'legendary': '传奇',
  'epic': '史诗',
  'rare': '稀有',
  'common': '普通'
};

// 类型映射
const TYPE_MAP = {
  '1': 'active',
  '2': 'passive'
};

// 类型中文名
const TYPE_NAMES = {
  'active': '主动技能',
  'passive': '被动技能'
};

/**
 * 解析技能ID
 * @param {string} skillId - 技能ID，如 skill_1_5001
 * @returns {Object} 解析结果
 */
function parseSkillId(skillId) {
  // 格式：skill_{类型}_{稀有度}{编号}
  const parts = skillId.split('_');
  
  if (parts.length !== 3 || parts[0] !== 'skill') {
    throw new Error(`无效的技能ID格式: ${skillId}`);
  }
  
  const typeCode = parts[1]; // '1' 或 '2'
  const rarityAndNumber = parts[2]; // '5001'
  
  const rarityCode = rarityAndNumber[0]; // '5'
  const number = rarityAndNumber.substring(1); // '001'
  
  const type = TYPE_MAP[typeCode];
  const rarity = RARITY_MAP[rarityCode];
  
  if (!type) {
    throw new Error(`无效的技能类型: ${typeCode} (技能ID: ${skillId})`);
  }
  
  if (!rarity) {
    throw new Error(`无效的稀有度: ${rarityCode} (技能ID: ${skillId})`);
  }
  
  return {
    type,
    typeCode,
    typeName: TYPE_NAMES[type],
    rarity,
    rarityCode,
    rarityName: RARITY_NAMES[rarity],
    number: parseInt(number, 10)
  };
}

/**
 * 解析CSV行
 * @param {string} line - CSV行
 * @returns {Array} 字段数组
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  fields.push(current.trim());
  return fields;
}

/**
 * 读取并解析CSV文件
 * @returns {Array} 技能数组
 */
function readCSV() {
  console.log('📖 读取CSV文件...');
  
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV文件不存在: ${CSV_PATH}`);
  }
  
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV文件为空或只有标题行');
  }
  
  // 解析标题行
  const headers = parseCSVLine(lines[0]);
  console.log(`   标题行: ${headers.join(', ')}`);
  
  // 解析数据行
  const skills = [];
  
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    
    if (fields.length !== headers.length) {
      console.warn(`⚠️  第${i + 1}行字段数量不匹配，跳过`);
      continue;
    }
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = fields[index];
    });
    
    skills.push(row);
  }
  
  console.log(`✅ 读取完成，共 ${skills.length} 个技能\n`);
  return skills;
}

/**
 * 转换为JSON格式
 * @param {Array} csvData - CSV数据
 * @returns {Array} JSON数据
 */
function convertToJSON(csvData) {
  console.log('🔄 转换为JSON格式...\n');
  
  const skills = [];
  const stats = {
    total: 0,
    byType: { active: 0, passive: 0 },
    byRarity: { core: 0, legendary: 0, epic: 0, rare: 0, common: 0 }
  };
  
  for (const row of csvData) {
    try {
      const skillId = row.skill_id;
      
      if (!skillId) {
        console.warn('⚠️  跳过空的技能ID');
        continue;
      }
      
      // 解析技能ID
      const parsed = parseSkillId(skillId);
      
      // 构建技能对象
      const skill = {
        id: skillId,
        name: row.skill_name || '',
        type: parsed.type,
        typeName: parsed.typeName,
        rarity: parsed.rarity,
        rarityName: parsed.rarityName,
        damageType: row.damage_type || null,
        characterType: row.character_type || null,  // 改为character_type
        effectType: row.effect_type || null,
        effectValue: row.effect_value || '',
        description: row.description || '',  // 新增description字段
      };
      
      skills.push(skill);
      
      // 统计
      stats.total++;
      stats.byType[parsed.type]++;
      stats.byRarity[parsed.rarity]++;
      
      console.log(`✅ ${skillId} - ${parsed.rarityName}${parsed.typeName}`);
      
    } catch (error) {
      console.error(`❌ 处理技能失败: ${error.message}`);
    }
  }
  
  console.log('\n📊 统计信息：');
  console.log(`   总计: ${stats.total} 个技能`);
  console.log(`   主动技能: ${stats.byType.active} 个`);
  console.log(`   被动技能: ${stats.byType.passive} 个`);
  console.log(`   核心: ${stats.byRarity.core} 个`);
  console.log(`   传奇: ${stats.byRarity.legendary} 个`);
  console.log(`   史诗: ${stats.byRarity.epic} 个`);
  console.log(`   稀有: ${stats.byRarity.rare} 个`);
  console.log(`   普通: ${stats.byRarity.common} 个\n`);
  
  return skills;
}

/**
 * 写入JSON文件
 * @param {Array} skills - 技能数组
 */
function writeJSON(skills) {
  console.log('💾 写入JSON文件...');
  
  // 确保目录存在
  const dir = path.dirname(JSON_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // 写入文件
  const json = JSON.stringify(skills, null, 2);
  fs.writeFileSync(JSON_PATH, json, 'utf-8');
  
  console.log(`✅ 写入完成: ${JSON_PATH}`);
  console.log(`   文件大小: ${(json.length / 1024).toFixed(2)} KB\n`);
}

/**
 * 主函数
 */
function main() {
  console.log('🎮 技能CSV转JSON工具\n');
  console.log('=' .repeat(50) + '\n');
  
  try {
    // 1. 读取CSV
    const csvData = readCSV();
    
    // 2. 转换为JSON
    const skills = convertToJSON(csvData);
    
    // 3. 写入JSON文件
    writeJSON(skills);
    
    console.log('=' .repeat(50));
    console.log('🎉 转换完成！\n');
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行
main();
