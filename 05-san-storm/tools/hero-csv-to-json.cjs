/**
 * 武将CSV转JSON工具
 * 
 * 功能：
 * 1. 从 hero-template.csv 读取武将数据
 * 2. 转换为 JSON 格式
 * 3. 输出到 public/data/shared/characters.json
 * 
 * 注意：
 * - CSV 是主数据源，JSON 是生成文件
 * - 每次运行都会完全重新生成 JSON
 * - 所有数据修改都应该在 CSV 中进行
 * - 如果需要重新生成属性和技能，请运行 update-hero-csv.cjs
 * 
 * 使用方法：
 * node tools/hero-csv-to-json.cjs
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  csvPath: path.join(__dirname, 'hero-template.csv'),
  jsonPath: path.join(__dirname, '../public/data/shared/characters.json'),
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
 * 转换CSV行为角色对象
 */
function csvRowToCharacter(row) {
  // 只处理S1赛季的角色
  if (row.season !== 'S1') {
    return null;
  }
  
  // 跳过没有基本信息的角色
  if (!row.character_name || !row.rarity || !row.character_type) {
    return null;
  }
  
  // 解析羁绊
  const bonds = row.bond && row.bond !== '无' ? row.bond.split(';').map(b => b.trim()) : [];
  
  // 解析技能（创建skills数组）
  const skills = [];
  if (row.skill_1 && row.skill_1 !== '') {
    skills.push(row.skill_1);
  }
  if (row.skill_2 && row.skill_2 !== '') {
    skills.push(row.skill_2);
  }
  
  // 构建角色对象（直接从CSV读取所有数据）
  return {
    id: row.character_id,
    name: row.character_name,
    rarity: row.rarity,
    faction: row.faction,
    season: row.season,
    birthYear: parseInt(row.birth_year) || 150,
    deathYear: row.death_year ? parseInt(row.death_year) : null,
    age: parseInt(row.age) || 0,
    stage: row.stage,
    characterType: row.character_type,  // CSV用下划线，JSON用驼峰
    luck: parseFloat(row.luck) || 5.0,
    courage: parseFloat(row.courage) || 5.0,
    command: parseFloat(row.command) || 5.0,
    combat: parseFloat(row.combat) || 5.0,
    intelligence: parseFloat(row.intelligence) || 5.0,
    politics: parseFloat(row.politics) || 5.0,
    charisma: parseFloat(row.charisma) || 5.0,
    morale: 50,
    skill_1: row.skill_1 || '',
    skill_2: row.skill_2 || '',
    skills: skills,  // 添加skills数组
    bonds: bonds,
    biography: row.biography || '',
    description: row.description || '',
  };
}

// ============================================================================
// 主函数
// ============================================================================

function main() {
  console.log('='.repeat(80));
  console.log('武将CSV转JSON工具');
  console.log('='.repeat(80));
  console.log('');
  
  // 1. 读取CSV数据
  console.log('📖 读取CSV数据...');
  const csvData = readCSV(CONFIG.csvPath);
  console.log(`   ✅ 读取到 ${csvData.length} 行数据`);
  console.log('');
  
  // 2. 转换为角色对象
  console.log('🔄 转换数据格式...');
  const characters = [];
  csvData.forEach((row) => {
    const char = csvRowToCharacter(row);
    if (char) {
      characters.push(char);
    }
  });
  console.log(`   ✅ 转换了 ${characters.length} 个S1赛季角色`);
  console.log('');
  
  // 3. 写入JSON文件
  console.log('💾 保存JSON文件...');
  const outputData = { characters };
  fs.writeFileSync(CONFIG.jsonPath, JSON.stringify(outputData, null, 2), 'utf8');
  console.log(`   ✅ 已保存到：${CONFIG.jsonPath}`);
  console.log('');
  
  // 4. 显示统计
  console.log('-'.repeat(80));
  console.log('📊 数据统计：');
  console.log('');
  
  // 按势力统计
  const factionStats = {};
  characters.forEach(char => {
    factionStats[char.faction] = (factionStats[char.faction] || 0) + 1;
  });
  
  console.log('势力分布：');
  Object.entries(factionStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([faction, count]) => {
      console.log(`  ${faction}: ${count} 个`);
    });
  console.log('');
  
  // 按稀有度统计
  const rarityStats = {};
  characters.forEach(char => {
    rarityStats[char.rarity] = (rarityStats[char.rarity] || 0) + 1;
  });
  
  console.log('稀有度分布：');
  const rarityOrder = ['core', 'legendary', 'epic', 'rare', 'common'];
  rarityOrder.forEach(rarity => {
    if (rarityStats[rarity]) {
      console.log(`  ${rarity}: ${rarityStats[rarity]} 个`);
    }
  });
  console.log('');
  
  // 按类型统计
  const typeStats = {};
  characters.forEach(char => {
    typeStats[char.characterType] = (typeStats[char.characterType] || 0) + 1;
  });
  
  console.log('类型分布：');
  Object.entries(typeStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count} 个`);
    });
  console.log('');
  
  // 按生涯统计
  const stageStats = {};
  characters.forEach(char => {
    stageStats[char.stage] = (stageStats[char.stage] || 0) + 1;
  });
  
  console.log('生涯分布：');
  const stageOrder = ['early', 'peak', 'late', 'death'];
  const stageNames = {
    early: '🌱 茅庐',
    peak: '⭐ 巅峰',
    late: '🧙 不惑',
    death: '💀 卒',
  };
  stageOrder.forEach(stage => {
    if (stageStats[stage]) {
      console.log(`  ${stageNames[stage]}: ${stageStats[stage]} 个`);
    }
  });
  console.log('');
  
  // 显示几个示例角色
  console.log('示例角色：');
  const examples = characters.slice(0, 3);
  examples.forEach(char => {
    const total = (char.luck + char.courage + char.command + char.combat + 
                   char.intelligence + char.politics + char.charisma).toFixed(1);
    console.log(`  ${char.name} (${char.rarity}, ${char.characterType})`);
    console.log(`    生涯: ${stageNames[char.stage]} (${char.age}岁)`);
    console.log(`    属性: 总计${total} (运${char.luck} 勇${char.courage} 统${char.command} 武${char.combat} 智${char.intelligence} 政${char.politics} 魅${char.charisma})`);
    console.log(`    技能: ${char.skill_1}, ${char.skill_2}`);
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
