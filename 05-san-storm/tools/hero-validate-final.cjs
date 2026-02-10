/**
 * 武将数据最终验证工具
 * 
 * 验证所有角色是否符合规则
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  csvPath: path.join(__dirname, 'hero-template-processed.csv'),
};

// ============================================================================
// 验证规则
// ============================================================================

function getBaseAttributeRange(rarity, characterType) {
  const ranges = {
    core: { military: [50, 60], strategist: [50, 60], balanced: [52, 62] },
    legendary: { military: [56, 60], strategist: [56, 60], balanced: [58, 62] },
    epic: { military: [52, 56], strategist: [52, 56], balanced: [54, 58] },
    rare: { military: [48, 52], strategist: [48, 52], balanced: [50, 54] },
    common: { military: [44, 48], strategist: [44, 48], balanced: [46, 50] },
  };
  return ranges[rarity][characterType];
}

function getStageModifier(stage) {
  const modifiers = { 
    early: 0.95,  // 茅庐：-5%
    peak: 1.0,    // 巅峰：无修正
    late: 0.90,   // 不惑：-10%
    dead: 0.80    // 卒：-20%
  };
  return modifiers[stage] || 1.0;
}

function validateCharacter(row) {
  if (row.season !== 'S1' || !row.character_name) {
    return { valid: true, skip: true };
  }
  
  // 检查必要字段
  if (!row.rarity || !row.CHARACTER_TYPES || !row.stage) {
    return { valid: false, message: '缺少必要字段' };
  }
  
  // 检查属性
  const attrs = ['luck', 'courage', 'command', 'combat', 'intelligence', 'politics', 'charisma'];
  const values = attrs.map(attr => parseFloat(row[attr] || 0));
  
  if (values.some(v => isNaN(v) || v === 0)) {
    return { valid: false, message: '缺少属性值' };
  }
  
  // 计算总属性点
  const total = values.reduce((sum, v) => sum + v, 0);
  
  // 获取期望范围
  const [minBase, maxBase] = getBaseAttributeRange(row.rarity, row.CHARACTER_TYPES);
  const modifier = getStageModifier(row.stage);
  const minExpected = minBase * modifier;
  const maxExpected = maxBase * modifier;
  
  // 验证总属性点（允许±2的误差）
  if (total < minExpected - 2 || total > maxExpected + 2) {
    return {
      valid: false,
      message: `总属性点不符`,
      total: total.toFixed(1),
      expected: `${minExpected.toFixed(1)}-${maxExpected.toFixed(1)}`,
      diff: (total - (minExpected + maxExpected) / 2).toFixed(1),
    };
  }
  
  return { valid: true, total: total.toFixed(1) };
}

// ============================================================================
// CSV处理
// ============================================================================

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

function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length >= headers.length && values[1]) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
  }
  
  return data;
}

// ============================================================================
// 主函数
// ============================================================================

function main() {
  console.log('='.repeat(80));
  console.log('武将数据最终验证');
  console.log('='.repeat(80));
  console.log('');
  
  // 读取数据
  console.log('📖 读取数据...');
  const data = readCSV(CONFIG.csvPath);
  const s1Characters = data.filter(r => r.season === 'S1' && r.name);
  console.log(`   ✅ 读取到 ${s1Characters.length} 个S1角色\n`);
  
  // 验证
  console.log('🔍 验证数据...\n');
  const errors = [];
  const passed = [];
  
  s1Characters.forEach(row => {
    const result = validateCharacter(row);
    if (result.skip) return;
    
    if (!result.valid) {
      errors.push({ name: row.character_name, ...result });
    } else {
      passed.push({ name: row.character_name, total: result.total });
    }
  });
  
  // 显示结果
  if (errors.length === 0) {
    console.log('   ✅ 所有角色验证通过！\n');
  } else {
    console.log(`   ❌ 发现 ${errors.length} 个错误：\n`);
    errors.forEach(err => {
      console.log(`   ${err.name}:`);
      console.log(`      ${err.message}`);
      console.log(`      实际: ${err.total}, 期望: ${err.expected}, 差值: ${err.diff}`);
      console.log('');
    });
  }
  
  // 统计
  console.log('-'.repeat(80));
  console.log('📊 验证统计：\n');
  console.log(`   通过: ${passed.length} 个`);
  console.log(`   错误: ${errors.length} 个`);
  console.log(`   总计: ${s1Characters.length} 个`);
  console.log('');
  
  // 按稀有度统计
  const rarityStats = {};
  s1Characters.forEach(r => {
    rarityStats[r.rarity] = (rarityStats[r.rarity] || 0) + 1;
  });
  
  console.log('稀有度分布：');
  Object.entries(rarityStats).sort((a, b) => b[1] - a[1]).forEach(([rarity, count]) => {
    console.log(`   ${rarity}: ${count} 个`);
  });
  console.log('');
  
  // 按阶段统计
  const stageStats = {
    early: s1Characters.filter(r => r.stage === 'early').length,
    peak: s1Characters.filter(r => r.stage === 'peak').length,
    late: s1Characters.filter(r => r.stage === 'late').length,
  };
  
  console.log('阶段分布：');
  console.log(`   茅庐(early): ${stageStats.early} 个`);
  console.log(`   巅峰(peak): ${stageStats.peak} 个`);
  console.log(`   不惑(late): ${stageStats.late} 个`);
  console.log('');
  
  console.log('-'.repeat(80));
  console.log('');
  
  if (errors.length === 0) {
    console.log('✅ 验证完成！所有角色数据符合规则。');
    console.log('');
    console.log('下一步：');
    console.log('1. 替换原文件：');
    console.log('   copy tools\\hero-template-processed.csv tools\\hero-template.csv');
    console.log('2. 运行转换工具生成JSON：');
    console.log('   node tools/hero-csv-to-json.cjs');
  } else {
    console.log('⚠️  请修正错误后重新验证。');
  }
  
  console.log('');
  console.log('='.repeat(80));
  
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
