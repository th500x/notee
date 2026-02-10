/**
 * 验证稀有度属性上限
 * 
 * 规则：
 * - core/legendary: 无上限（可达10.0）
 * - epic: 单项属性 < 9.5
 * - rare: 单项属性 < 8.5
 * - common: 单项属性 < 8.0
 * - 所有单项属性至少 > 3.0
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  csvPath: path.join(__dirname, 'hero-template.csv'),
};

// 稀有度单项属性上限
const RARITY_MAX_MAP = {
  core: 10.0,
  legendary: 10.0,
  epic: 9.5,
  rare: 8.5,
  common: 8.0,
};

// 读取CSV文件
function readCSV(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 去除BOM
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  const lines = content.split('\n').filter(line => line.trim());
  const headers = parseCSVLine(lines[0]);
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= headers.length - 5 && values[1]) {
      const row = {};
      headers.forEach((header, index) => {
        row[header.trim()] = (values[index] || '').trim();
      });
      data.push(row);
    }
  }
  
  return data;
}

// 解析CSV行
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

// 主函数
function main() {
  console.log('='.repeat(80));
  console.log('验证稀有度属性上限');
  console.log('='.repeat(80));
  console.log('');
  
  // 读取数据
  console.log('📖 读取CSV数据...');
  const data = readCSV(CONFIG.csvPath);
  const s1Characters = data.filter(row => row.season === 'S1' && row.character_name && row.rarity);
  console.log(`   ✅ 读取到 ${s1Characters.length} 个S1角色`);
  console.log('');
  
  // 验证
  console.log('🔍 验证稀有度属性上限...');
  console.log('');
  
  const errors = [];
  const attributeKeys = ['luck', 'courage', 'command', 'combat', 'intelligence', 'politics', 'charisma'];
  
  s1Characters.forEach(char => {
    const rarity = char.rarity;
    const maxAllowed = RARITY_MAX_MAP[rarity];
    
    if (!maxAllowed) {
      errors.push(`${char.character_name}: 未知稀有度 "${rarity}"`);
      return;
    }
    
    attributeKeys.forEach(attr => {
      const value = parseFloat(char[attr]);
      
      if (isNaN(value)) {
        errors.push(`${char.character_name}: ${attr} 值无效 "${char[attr]}"`);
        return;
      }
      
      // 检查下限
      if (value < 3.0) {
        errors.push(`${char.character_name} (${rarity}): ${attr}=${value} < 3.0 (最小值)`);
      }
      
      // 检查上限（根据稀有度）
      if (rarity === 'epic' && value >= 9.5) {
        errors.push(`${char.character_name} (epic): ${attr}=${value} >= 9.5 (应该 < 9.5)`);
      } else if (rarity === 'rare' && value >= 8.5) {
        errors.push(`${char.character_name} (rare): ${attr}=${value} >= 8.5 (应该 < 8.5)`);
      } else if (rarity === 'common' && value >= 8.0) {
        errors.push(`${char.character_name} (common): ${attr}=${value} >= 8.0 (应该 < 8.0)`);
      } else if (value > 10.0) {
        errors.push(`${char.character_name} (${rarity}): ${attr}=${value} > 10.0 (绝对上限)`);
      }
    });
  });
  
  // 显示结果
  console.log('-'.repeat(80));
  
  if (errors.length === 0) {
    console.log('✅ 所有属性都符合稀有度限制！');
    console.log('');
    
    // 显示统计
    console.log('📊 稀有度属性统计：');
    console.log('');
    
    ['core', 'legendary', 'epic', 'rare', 'common'].forEach(rarity => {
      const chars = s1Characters.filter(c => c.rarity === rarity);
      if (chars.length === 0) return;
      
      const maxAllowed = RARITY_MAX_MAP[rarity];
      const maxValues = {};
      
      attributeKeys.forEach(attr => {
        const values = chars.map(c => parseFloat(c[attr])).filter(v => !isNaN(v));
        maxValues[attr] = Math.max(...values);
      });
      
      console.log(`${rarity} (上限: ${maxAllowed === 10.0 ? '无限制' : `< ${maxAllowed}`}):`);
      console.log(`  角色数: ${chars.length}`);
      console.log(`  最高属性值: ${Object.entries(maxValues).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      console.log('');
    });
    
  } else {
    console.log(`❌ 发现 ${errors.length} 个错误：`);
    console.log('');
    errors.forEach(err => console.log(`  - ${err}`));
    console.log('');
  }
  
  console.log('-'.repeat(80));
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
