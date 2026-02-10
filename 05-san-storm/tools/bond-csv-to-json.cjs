#!/usr/bin/env node

/**
 * 羁绊CSV转JSON工具
 * 
 * 功能：
 * 1. 从 bond-template.csv 读取羁绊数据
 * 2. 自动解析羁绊ID，提取类型和稀有度
 * 3. 转换为 JSON 格式
 * 4. 输出到 public/data/shared/bonds.json
 * 
 * 注意：
 * - 羁绊的角色关联信息存储在 hero-template.csv 中
 * - 本工具只生成羁绊的基础信息（ID、名称、效果）
 * 
 * 使用方法：
 * node tools/bond-csv-to-json.cjs
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  csvPath: path.join(__dirname, 'bond-template.csv'),
  jsonPath: path.join(__dirname, '../public/data/shared/bonds.json'),
};

console.log('🎮 羁绊CSV转JSON工具\n');

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 解析羁绊ID
 * @param {string} bondId - 羁绊ID，格式：bond_{类型}_{稀有度}{编号}
 * @returns {Object} { type, rarity, number }
 */
function parseBondId(bondId) {
  // 格式：bond_1_5001 或 bond_2_4001
  const match = bondId.match(/^bond_(\d)_(\d)(\d{3})$/);
  
  if (!match) {
    throw new Error(`无效的羁绊ID格式: ${bondId}`);
  }
  
  const typeCode = match[1];
  const rarityCode = match[2];
  const number = match[3];
  
  // 类型映射
  const typeMap = {
    '1': 'active',
    '2': 'passive',
  };
  
  // 稀有度映射
  const rarityMap = {
    '5': 'core',
    '4': 'legendary',
    '3': 'epic',
    '2': 'rare',
    '1': 'common',
  };
  
  return {
    type: typeMap[typeCode] || 'unknown',
    rarity: rarityMap[rarityCode] || 'unknown',
    number: number,
  };
}

/**
 * 解析CSV行（处理逗号和引号）
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

/**
 * 读取CSV文件
 */
function readCSV(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 去除BOM（如果存在）
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV文件为空');
  }
  
  const headers = parseCSVLine(lines[0]);
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (values.length < headers.length - 2) {
      // 允许末尾字段缺失
      continue;
    }
    
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = (values[index] || '').trim();
    });
    
    // 检查是否有有效的ID
    if (row.bond_id && row.bond_id.startsWith('bond_')) {
      data.push(row);
    }
  }
  
  return data;
}

/**
 * 转换CSV行为羁绊对象
 */
function csvRowToBond(row) {
  const bondId = row.bond_id;
  const parsed = parseBondId(bondId);
  
  // 类型中文名
  const typeNameMap = {
    'active': '主动羁绊',
    'passive': '被动羁绊',
  };
  
  // 稀有度中文名
  const rarityNameMap = {
    'core': '核心',
    'legendary': '传奇',
    'epic': '史诗',
    'rare': '稀有',
    'common': '普通',
  };
  
  // 解析最小角色数
  const minCharacters = parseInt(row.min_characters) || 2;
  
  return {
    id: bondId,
    name: row.bond_name || '',
    type: parsed.type,
    typeName: typeNameMap[parsed.type] || parsed.type,
    rarity: parsed.rarity,
    rarityName: rarityNameMap[parsed.rarity] || parsed.rarity,
    minCharacters: minCharacters,
    effectType: row.effect_type || null,
    effectValue: row.effect_value || '',
    description: row.description || '',  // 新增description字段
  };
}

// ============================================================================
// 主函数
// ============================================================================

function main() {
  try {
    // 1. 读取CSV数据
    console.log('📖 读取CSV文件...');
    console.log(`   文件路径: ${CONFIG.csvPath}`);
    
    const csvData = readCSV(CONFIG.csvPath);
    console.log(`✅ 读取完成，共 ${csvData.length} 个羁绊\n`);
    
    // 2. 转换为羁绊对象
    console.log('🔄 转换为JSON格式...\n');
    
    const bonds = [];
    const stats = {
      total: 0,
      byType: { active: 0, passive: 0 },
      byRarity: { core: 0, legendary: 0, epic: 0, rare: 0, common: 0 },
    };
    
    csvData.forEach(row => {
      try {
        const bond = csvRowToBond(row);
        bonds.push(bond);
        
        stats.total++;
        stats.byType[bond.type]++;
        stats.byRarity[bond.rarity]++;
        
        console.log(`✅ ${bond.id} - ${bond.rarityName}${bond.typeName}`);
      } catch (err) {
        console.error(`❌ 转换失败: ${row.bond_id}`);
        console.error(`   错误: ${err.message}`);
      }
    });
    
    console.log('');
    
    // 3. 写入JSON文件
    console.log('💾 写入JSON文件...');
    
    // 确保目录存在
    const dir = path.dirname(CONFIG.jsonPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(
      CONFIG.jsonPath,
      JSON.stringify(bonds, null, 2),
      'utf8'
    );
    
    const fileSize = (fs.statSync(CONFIG.jsonPath).size / 1024).toFixed(2);
    console.log(`✅ 写入完成: ${CONFIG.jsonPath}`);
    console.log(`   文件大小: ${fileSize} KB\n`);
    
    // 4. 显示统计
    console.log('📊 统计信息：');
    console.log(`   总计: ${stats.total} 个羁绊`);
    console.log(`   主动羁绊: ${stats.byType.active} 个`);
    console.log(`   被动羁绊: ${stats.byType.passive} 个`);
    console.log('');
    
    console.log('   按稀有度：');
    Object.entries(stats.byRarity).forEach(([rarity, count]) => {
      if (count > 0) {
        console.log(`   ${rarity}: ${count} 个`);
      }
    });
    console.log('');
    
    console.log('🎉 转换完成！');
    
  } catch (error) {
    console.error('❌ 错误：', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行
main();
