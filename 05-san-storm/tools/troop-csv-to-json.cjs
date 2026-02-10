#!/usr/bin/env node

/**
 * 部队CSV转JSON工具
 * 
 * 功能：
 * 1. 从 troop-template.csv 读取部队数据
 * 2. 转换为 JSON 格式
 * 3. 输出到 public/data/shared/troops.json
 * 
 * 注意：
 * - CSV 是主数据源，JSON 是生成文件
 * - 每次运行都会完全重新生成 JSON
 * - 所有数据修改都应该在 CSV 中进行
 * 
 * 使用方法：
 * node tools/troop-csv-to-json.cjs
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  csvPath: path.join(__dirname, 'troop-template.csv'),
  jsonPath: path.join(__dirname, '../public/data/shared/troops.json'),
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 读取CSV文件
 */
function readCSV(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 去除BOM（如果存在）
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  const lines = content.split('\n').filter(line => line.trim());
  
  const headers = parseCSVLine(lines[0]);
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= headers.length - 5 && values[1]) { // 允许末尾字段缺失，确保有name
      const row = {};
      headers.forEach((header, index) => {
        row[header.trim()] = (values[index] || '').trim();
      });
      data.push(row);
    }
  }
  
  return data;
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
 * 转换CSV行为部队对象
 */
function csvRowToTroop(row) {
  // 跳过没有基本信息的部队
  if (!row.troop_name || !row.rarity || !row.troop_type) {
    return null;
  }
  
  // 构建部队对象（CSV字段 → JSON字段，snake_case → camelCase）
  return {
    id: row.troop_id || '',
    name: row.troop_name,
    rarity: row.rarity,
    troopType: row.troop_type,
    range: parseInt(row.range) || 1,
    attack: parseInt(row.attack) || 0,
    defense: parseInt(row.defense) || 0,
    speed: parseInt(row.speed) || 0,
    movement: parseInt(row.movement) || 0,
    maxTroops: parseInt(row.max_troops) || 0,
    plainAdapt: parseFloat(row.plain_adapt) || 1.0,
    hillAdapt: parseFloat(row.hill_adapt) || 1.0,
    forestAdapt: parseFloat(row.forest_adapt) || 1.0,
    siegeAdapt: parseFloat(row.siege_adapt) || 1.0,
    counterType: row.counter_type || '',
    counteredBy: row.countered_by || '',
    counterMultiplier: parseFloat(row.counter_multiplier) || 1.0,
    skill_3: row.skill_3 || '',
    skill_4: row.skill_4 || '',
    skills: [row.skill_3, row.skill_4].filter(s => s), // 创建skills数组，过滤空值
    description: row.description || '',
  };
}

// ============================================================================
// 主函数
// ============================================================================

function main() {
  console.log('='.repeat(80));
  console.log('部队CSV转JSON工具');
  console.log('='.repeat(80));
  console.log('');
  
  // 1. 读取CSV数据
  console.log('📖 读取CSV数据...');
  const csvData = readCSV(CONFIG.csvPath);
  console.log(`   ✅ 读取到 ${csvData.length} 行数据`);
  console.log('');
  
  // 2. 转换为部队对象
  console.log('🔄 转换数据格式...');
  const troops = [];
  csvData.forEach((row) => {
    const troop = csvRowToTroop(row);
    if (troop) {
      troops.push(troop);
    }
  });
  console.log(`   ✅ 转换了 ${troops.length} 个部队`);
  console.log('');
  
  // 3. 写入JSON文件
  console.log('💾 保存JSON文件...');
  
  // 确保目录存在
  const dir = path.dirname(CONFIG.jsonPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const outputData = { troops };
  fs.writeFileSync(CONFIG.jsonPath, JSON.stringify(outputData, null, 2), 'utf8');
  console.log(`   ✅ 已保存到：${CONFIG.jsonPath}`);
  console.log('');
  
  // 4. 显示统计
  console.log('-'.repeat(80));
  console.log('📊 数据统计：');
  console.log('');
  
  // 按兵种统计
  const typeStats = {};
  troops.forEach(troop => {
    typeStats[troop.troopType] = (typeStats[troop.troopType] || 0) + 1;
  });
  
  console.log('兵种分布：');
  const typeNames = {
    infantry: '步兵',
    cavalry: '骑兵',
    archer: '弓兵',
  };
  Object.entries(typeStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${typeNames[type] || type}: ${count} 个`);
    });
  console.log('');
  
  // 按稀有度统计
  const rarityStats = {};
  troops.forEach(troop => {
    rarityStats[troop.rarity] = (rarityStats[troop.rarity] || 0) + 1;
  });
  
  console.log('稀有度分布：');
  const rarityOrder = ['core', 'legendary', 'epic', 'rare', 'common'];
  const rarityNames = {
    core: '核心',
    legendary: '传奇',
    epic: '史诗',
    rare: '稀有',
    common: '普通',
  };
  rarityOrder.forEach(rarity => {
    if (rarityStats[rarity]) {
      console.log(`  ${rarityNames[rarity]}: ${rarityStats[rarity]} 个`);
    }
  });
  console.log('');
  
  // 显示几个示例部队
  console.log('示例部队：');
  const examples = troops.slice(0, 3);
  examples.forEach(troop => {
    console.log(`  ${troop.name} (${rarityNames[troop.rarity]}, ${typeNames[troop.troopType]})`);
    console.log(`    战斗: 攻${troop.attack} 防${troop.defense} 速${troop.speed} 移${troop.movement}`);
    console.log(`    兵力: ${troop.maxTroops}人 射程: ${troop.range}格`);
    console.log(`    克制: ${typeNames[troop.counterType]} (${troop.counterMultiplier}x) 被克: ${typeNames[troop.counteredBy]}`);
    console.log(`    地形: 平原${troop.plainAdapt} 丘陵${troop.hillAdapt} 森林${troop.forestAdapt} 攻城${troop.siegeAdapt}`);
    if (troop.skills.length > 0) {
      console.log(`    技能: ${troop.skills.join(', ')}`);
    }
    console.log('');
  });
  
  console.log('-'.repeat(80));
  console.log('');
  console.log('✅ 转换完成！');
  console.log('');
  console.log('='.repeat(80));
}

// 运行
try {
  main();
} catch (error) {
  console.error('❌ 错误：', error.message);
  console.error(error.stack);
  process.exit(1);
}
