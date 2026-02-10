/**
 * 官职CSV转JSON工具
 * 
 * 用法: node tools/position-csv-to-json.cjs
 * 
 * 功能:
 * - 读取 tools/position-template.csv
 * - 转换为 JSON 格式
 * - 输出到 public/data/shared/positions.json
 */

const fs = require('fs');
const path = require('path');

// CSV 解析函数（处理引号内的逗号和换行）
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

// 读取CSV文件
function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV文件格式错误：至少需要标题行和一行数据');
  }
  
  const headers = parseCSVLine(lines[0]);
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    // 跳过空行或无效行（第一个字段为空）
    if (!values[0] || values[0].trim() === '') {
      continue;
    }
    
    const row = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    data.push(row);
  }
  
  return data;
}

// 转换为官职JSON格式
function convertToPositionJSON(csvData) {
  const positions = csvData.map(row => {
    // 解析加成数据
    const bonuses = {};
    if (parseFloat(row.resourceBonus) > 0) bonuses.resourceBonus = parseFloat(row.resourceBonus);
    if (parseFloat(row.prestigeBonus) > 0) bonuses.prestigeBonus = parseFloat(row.prestigeBonus);
    if (parseFloat(row.infantryBonus) > 0) bonuses.infantryBonus = parseFloat(row.infantryBonus);
    if (parseFloat(row.cavalryBonus) > 0) bonuses.cavalryBonus = parseFloat(row.cavalryBonus);
    if (parseFloat(row.archerBonus) > 0) bonuses.archerBonus = parseFloat(row.archerBonus);
    
    // 解析权限列表（使用 | 分隔）
    const permissions = row.permissions 
      ? row.permissions.split('|').map(p => p.trim()).filter(p => p)
      : [];
    
    // 构建官职对象
    const position = {
      id: row.id,
      name: row.name,
      level: parseInt(row.level),
      icon: row.icon,
      rank: parseInt(row.rank),
      requirement: row.requirement,
      bonuses: bonuses,
      permissions: permissions,
      color: row.color,
      description: row.description
    };
    
    return position;
  });
  
  return { positions };
}

// 主函数
function main() {
  try {
    console.log('开始转换官职CSV数据...\n');
    
    // 文件路径
    const csvPath = path.join(__dirname, 'position-template.csv');
    const jsonPath = path.join(__dirname, '../public/data/shared/positions.json');
    
    // 检查CSV文件是否存在
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV文件不存在: ${csvPath}`);
    }
    
    // 读取CSV
    console.log('📖 读取CSV文件:', csvPath);
    const csvData = readCSV(csvPath);
    console.log(`✓ 成功读取 ${csvData.length} 条官职数据\n`);
    
    // 转换为JSON
    console.log('🔄 转换数据格式...');
    const jsonData = convertToPositionJSON(csvData);
    console.log(`✓ 成功转换 ${jsonData.positions.length} 个官职\n`);
    
    // 输出统计信息
    console.log('📊 官职统计:');
    const levelCounts = {};
    jsonData.positions.forEach(pos => {
      levelCounts[pos.level] = (levelCounts[pos.level] || 0) + 1;
    });
    Object.keys(levelCounts).sort((a, b) => b - a).forEach(level => {
      console.log(`   等级 ${level}: ${levelCounts[level]} 个官职`);
    });
    console.log();
    
    // 写入JSON文件
    console.log('💾 写入JSON文件:', jsonPath);
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(jsonData, null, 2),
      'utf-8'
    );
    console.log('✓ 成功写入文件\n');
    
    console.log('✅ 转换完成！');
    console.log(`   输入: ${csvPath}`);
    console.log(`   输出: ${jsonPath}`);
    console.log(`   官职总数: ${jsonData.positions.length}`);
    
  } catch (error) {
    console.error('❌ 转换失败:', error.message);
    process.exit(1);
  }
}

// 运行
main();
