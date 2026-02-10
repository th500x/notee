/**
 * 势力CSV转JSON工具
 * 
 * 使用方法：
 * node tools/faction-csv-to-json.cjs
 * 
 * 输入：tools/faction-template.csv
 * 输出：public/data/seasons/s1/factions.json
 */

const fs = require('fs');
const path = require('path');

// CSV文件路径
const CSV_FILE = path.join(__dirname, 'faction-template.csv');
const OUTPUT_FILE = path.join(__dirname, '../public/data/seasons/s1/factions.json');

/**
 * 解析CSV行
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * 读取CSV文件
 */
function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  // 第一行是表头
  const headers = parseCSVLine(lines[0]);
  
  // 解析数据行
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    data.push(row);
  }
  
  return data;
}

/**
 * 转换为JSON格式
 */
function convertToJSON(csvData) {
  // 过滤掉空行（faction_id为空的行）
  const validData = csvData.filter(row => row.faction_id && row.faction_id.trim());
  
  const factions = validData.map(row => {
    // 收集所有bonus字段
    const bonuses = [];
    for (let i = 1; i <= 4; i++) {
      const bonus = row[`bonus${i}`];
      if (bonus && bonus.trim()) {
        bonuses.push(bonus.trim());
      }
    }
    
    return {
      id: row.faction_id,
      name: row.faction_name,
      leader: row.faction_leader,
      icon: row.icon,
      color: row.color,
      season: row.season,
      style: row.styleType,
      styleText: row.styleTypeText,
      playerType: row.playerType,
      playerTypeText: row.playerTypeText,
      maxPlayers: parseInt(row.maxPlayers) || 0,
      bonuses: bonuses,
      description: row.description,
      recommended: row.recommended === 'TRUE' || row.recommended === 'true',
      difficulty: row.difficulty
    };
  });
  
  // 计算总玩家数
  const totalMaxPlayers = factions.reduce((sum, faction) => sum + faction.maxPlayers, 0);
  
  // 获取赛季信息（从第一个势力）
  const season = factions[0]?.season || 'S1';
  const seasonNames = {
    'S1': '黄巾之乱',
    'S2': '董卓之乱',
    'S3': '群雄割据'
  };
  
  return {
    season: season,
    seasonName: seasonNames[season] || season,
    factions: factions,
    metadata: {
      totalFactions: factions.length,
      totalMaxPlayers: totalMaxPlayers,
      generatedAt: new Date().toISOString()
    }
  };
}

/**
 * 主函数
 */
function main() {
  try {
    console.log('📖 读取CSV文件:', CSV_FILE);
    const csvData = readCSV(CSV_FILE);
    console.log(`✅ 成功读取 ${csvData.length} 个势力`);
    
    console.log('\n🔄 转换为JSON格式...');
    const jsonData = convertToJSON(csvData);
    
    console.log('\n📊 势力统计:');
    jsonData.factions.forEach(faction => {
      console.log(`  - ${faction.name} (${faction.leader}): ${faction.maxPlayers}人, ${faction.difficulty}`);
    });
    console.log(`  总计: ${jsonData.metadata.totalFactions}个势力, ${jsonData.metadata.totalMaxPlayers}个玩家位`);
    
    // 确保输出目录存在
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log('\n💾 保存JSON文件:', OUTPUT_FILE);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(jsonData, null, 2), 'utf-8');
    
    console.log('\n✨ 转换完成！');
    console.log(`\n📁 输出文件: ${OUTPUT_FILE}`);
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行
main();
