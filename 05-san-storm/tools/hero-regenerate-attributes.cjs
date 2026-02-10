/**
 * 重新生成武将属性工具
 * 
 * 功能：
 * 1. 读取原始CSV（用户提供的）
 * 2. 识别哪些角色缺少属性（需要重新生成）
 * 3. 按新规则重新生成属性
 * 4. 保留用户手动填写的属性
 * 
 * 新规则：
 * - epic武将单项属性值 < 9.5
 * - rare武将单项属性值 < 8.5
 * - common武将单项属性值 < 8.0
 * - 所有单项属性至少 > 3.0
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  inputCSV: path.join(__dirname, 'hero-template.csv'),
  outputCSV: path.join(__dirname, 'hero-template-regenerated.csv'),
};

// ============================================================================
// 属性生成规则（新规则）
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

function determineStage(age) {
  if (age <= 22) return 'early';  // 茅庐：22岁及以下
  if (age <= 45) return 'peak';   // 巅峰：23-45岁
  return 'late';                   // 不惑：46岁及以上
  // 注意：'dead'（卒）状态需要手动设置，不能通过年龄自动判断
}

/**
 * 获取单项属性上限（根据稀有度）
 */
function getMaxAttributeByRarity(rarity) {
  const maxAttributes = {
    core: 10.0,        // 核心：无上限
    legendary: 10.0,   // 传奇：无上限
    epic: 9.4,         // 史诗：< 9.5
    rare: 8.4,         // 稀有：< 8.5
    common: 7.9,       // 普通：< 8.0
  };
  return maxAttributes[rarity] || 10.0;
}

/**
 * 生成武官型属性
 */
function generateMilitaryAttributes(totalPoints, rarity) {
  const maxAttr = getMaxAttributeByRarity(rarity);
  const minAttr = 3.0;
  
  // 多次尝试生成合理的属性分配
  for (let attempt = 0; attempt < 100; attempt++) {
    const luck = minAttr + Math.random() * Math.min(5.0, maxAttr - minAttr);
    const courage = Math.max(minAttr, Math.min(8.0 + Math.random() * 1.4, maxAttr));
    
    const remainingPoints = totalPoints - luck - courage;
    const militaryRatio = 0.55 + Math.random() * 0.05;
    const militaryPoints = remainingPoints * militaryRatio;
    const intellectPoints = remainingPoints * (1 - militaryRatio);
    
    // 武力组
    const commandRatio = 0.45 + Math.random() * 0.1;
    const command = Math.max(minAttr, Math.min(militaryPoints * commandRatio, maxAttr));
    const combat = Math.max(minAttr, Math.min(militaryPoints - command, maxAttr));
    
    // 智力组
    const intellectRatio1 = 0.3 + Math.random() * 0.1;
    const intellectRatio2 = 0.3 + Math.random() * 0.1;
    const intelligence = Math.max(minAttr, Math.min(intellectPoints * intellectRatio1, maxAttr));
    const politics = Math.max(minAttr, Math.min(intellectPoints * intellectRatio2, maxAttr));
    const charisma = Math.max(minAttr, Math.min(intellectPoints - intelligence - politics, maxAttr));
    
    // 验证总和
    const total = luck + courage + command + combat + intelligence + politics + charisma;
    if (Math.abs(total - totalPoints) < 1.0) {
      return {
        luck: parseFloat(luck.toFixed(1)),
        courage: parseFloat(courage.toFixed(1)),
        command: parseFloat(command.toFixed(1)),
        combat: parseFloat(combat.toFixed(1)),
        intelligence: parseFloat(intelligence.toFixed(1)),
        politics: parseFloat(politics.toFixed(1)),
        charisma: parseFloat(charisma.toFixed(1)),
      };
    }
  }
  
  // 如果100次都失败，使用简单平均分配
  const avg = totalPoints / 7;
  return {
    luck: parseFloat(Math.max(minAttr, Math.min(avg, maxAttr)).toFixed(1)),
    courage: parseFloat(Math.max(minAttr, Math.min(avg, maxAttr)).toFixed(1)),
    command: parseFloat(Math.max(minAttr, Math.min(avg, maxAttr)).toFixed(1)),
    combat: parseFloat(Math.max(minAttr, Math.min(avg, maxAttr)).toFixed(1)),
    intelligence: parseFloat(Math.max(minAttr, Math.min(avg, maxAttr)).toFixed(1)),
    politics: parseFloat(Math.max(minAttr, Math.min(avg, maxAttr)).toFixed(1)),
    charisma: parseFloat(Math.max(minAttr, Math.min(avg, maxAttr)).toFixed(1)),
  };
}

/**
 * 生成军师型属性
 */
function generateStrategistAttributes(totalPoints, rarity) {
  const maxAttr = getMaxAttributeByRarity(rarity);
  const minAttr = 3.0;
  
  for (let attempt = 0; attempt < 100; attempt++) {
    const luck = minAttr + Math.random() * Math.min(5.0, maxAttr - minAttr);
    const courage = minAttr + Math.random() * Math.min(4.0, maxAttr - minAttr);
    
    const remainingPoints = totalPoints - luck - courage;
    const intellectRatio = 0.60 + Math.random() * 0.05;
    const intellectPoints = remainingPoints * intellectRatio;
    const militaryPoints = remainingPoints * (1 - intellectRatio);
    
    // 智力组
    const ratio1 = 0.35 + Math.random() * 0.05;
    const ratio2 = 0.30 + Math.random() * 0.05;
    const intelligence = Math.max(minAttr, Math.min(intellectPoints * ratio1, maxAttr));
    const politics = Math.max(minAttr, Math.min(intellectPoints * ratio2, maxAttr));
    const charisma = Math.max(minAttr, Math.min(intellectPoints - intelligence - politics, maxAttr));
    
    // 武力组
    const commandRatio = 0.5 + Math.random() * 0.1;
    const command = Math.max(minAttr, Math.min(militaryPoints * commandRatio, maxAttr));
    const combat = Math.max(minAttr, Math.min(militaryPoints - command, maxAttr));
    
    const total = luck + courage + command + combat + intelligence + politics + charisma;
    if (Math.abs(total - totalPoints) < 1.0) {
      return {
        luck: parseFloat(luck.toFixed(1)),
        courage: parseFloat(courage.toFixed(1)),
        command: parseFloat(command.toFixed(1)),
        combat: parseFloat(combat.toFixed(1)),
        intelligence: parseFloat(intelligence.toFixed(1)),
        politics: parseFloat(politics.toFixed(1)),
        charisma: parseFloat(charisma.toFixed(1)),
      };
    }
  }
  
  const avg = totalPoints / 7;
  return {
    luck: parseFloat(Math.max(minAttr, Math.min(avg, maxAttr)).toFixed(1)),
    courage: parseFloat(Math.max(minAttr, Math.min(avg, maxAttr)).toFixed(1)),
    command: parseFloat(Math.max(minAttr, Math.min(avg, maxAttr)).toFixed(1)),
    combat: parseFloat(Math.max(minAttr, Math.min(avg, maxAttr)).toFixed(1)),
    intelligence: parseFloat(Math.max(minAttr, Math.min(avg, maxAttr)).toFixed(1)),
    politics: parseFloat(Math.max(minAttr, Math.min(avg, maxAttr)).toFixed(1)),
    charisma: parseFloat(Math.max(minAttr, Math.min(avg, maxAttr)).toFixed(1)),
  };
}

/**
 * 生成文武双全型属性
 */
function generateBalancedAttributes(totalPoints, rarity) {
  const maxAttr = getMaxAttributeByRarity(rarity);
  const minAttr = 3.0;
  const avg = totalPoints / 7;
  
  return {
    luck: parseFloat(Math.max(minAttr, Math.min(avg + (Math.random() - 0.5) * 2, maxAttr)).toFixed(1)),
    courage: parseFloat(Math.max(minAttr, Math.min(avg + (Math.random() - 0.5) * 2, maxAttr)).toFixed(1)),
    command: parseFloat(Math.max(minAttr, Math.min(avg + (Math.random() - 0.5) * 2, maxAttr)).toFixed(1)),
    combat: parseFloat(Math.max(minAttr, Math.min(avg + (Math.random() - 0.5) * 2, maxAttr)).toFixed(1)),
    intelligence: parseFloat(Math.max(minAttr, Math.min(avg + (Math.random() - 0.5) * 2, maxAttr)).toFixed(1)),
    politics: parseFloat(Math.max(minAttr, Math.min(avg + (Math.random() - 0.5) * 2, maxAttr)).toFixed(1)),
    charisma: parseFloat(Math.max(minAttr, Math.min(avg + (Math.random() - 0.5) * 2, maxAttr)).toFixed(1)),
  };
}

function generateAttributes(rarity, stage, characterType) {
  const [minBase, maxBase] = getBaseAttributeRange(rarity, characterType);
  const basePoints = minBase + Math.random() * (maxBase - minBase);
  const modifier = getStageModifier(stage);
  const totalPoints = basePoints * modifier;
  
  if (characterType === 'military') {
    return generateMilitaryAttributes(totalPoints, rarity);
  } else if (characterType === 'strategist') {
    return generateStrategistAttributes(totalPoints, rarity);
  } else {
    return generateBalancedAttributes(totalPoints, rarity);
  }
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
  
  return { headers, data };
}

function processRow(row) {
  if (row.season !== 'S1' || !row.character_name || !row.rarity) {
    return row;
  }
  
  // 1. 判断stage
  if (!row.stage && row.age) {
    const age = parseInt(row.age);
    row.stage = determineStage(age);
  }
  
  // 2. 检查是否需要重新生成属性
  const hasAttributes = row.luck && row.courage && row.command && row.combat && 
                       row.intelligence && row.politics && row.charisma;
  
  if (!hasAttributes && row.CHARACTER_TYPES && row.stage) {
    // 重新生成属性
    const attributes = generateAttributes(row.rarity, row.stage, row.CHARACTER_TYPES);
    row.luck = attributes.luck;
    row.courage = attributes.courage;
    row.command = attributes.command;
    row.combat = attributes.combat;
    row.intelligence = attributes.intelligence;
    row.politics = attributes.politics;
    row.charisma = attributes.charisma;
  }
  
  return row;
}

function writeCSV(filePath, headers, data) {
  const lines = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = String(row[header] || '');
      if (value.includes(',') || value.includes('"')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    lines.push(values.join(','));
  });
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('重新生成武将属性工具（新规则）');
  console.log('='.repeat(80));
  console.log('');
  console.log('新规则：');
  console.log('  - epic武将单项属性值 < 9.5');
  console.log('  - rare武将单项属性值 < 8.5');
  console.log('  - common武将单项属性值 < 8.0');
  console.log('  - 所有单项属性至少 > 3.0');
  console.log('');
  
  // 读取CSV
  console.log('📖 读取CSV数据...');
  const { headers, data } = readCSV(CONFIG.inputCSV);
  console.log(`   ✅ 读取到 ${data.length} 行数据\n`);
  
  // 处理数据
  console.log('⚙️  重新生成属性...');
  let regeneratedCount = 0;
  
  const processedData = data.map(row => {
    const hasOriginalAttrs = row.luck && row.courage;
    const processed = processRow(row);
    
    if (processed.season === 'S1' && processed.name && !hasOriginalAttrs && processed.luck) {
      regeneratedCount++;
      console.log(`   ✅ ${processed.name} (${processed.rarity})`);
    }
    
    return processed;
  });
  
  console.log(`\n   总计重新生成: ${regeneratedCount} 个角色\n`);
  
  // 保存
  console.log('💾 保存CSV文件...');
  writeCSV(CONFIG.outputCSV, headers, processedData);
  console.log(`   ✅ 已保存到：${CONFIG.outputCSV}\n`);
  
  console.log('-'.repeat(80));
  console.log('');
  console.log('✅ 重新生成完成！');
  console.log('');
  console.log('下一步：');
  console.log('1. 检查 hero-template-regenerated.csv');
  console.log('2. 运行验证工具：node tools/hero-validate-final.cjs');
  console.log('3. 如果满意，替换原文件：');
  console.log('   copy tools\\hero-template-regenerated.csv tools\\hero-template.csv');
  console.log('4. 生成JSON：node tools/hero-csv-to-json.cjs');
  console.log('');
  console.log('='.repeat(80));
}

main().catch(error => {
  console.error('处理失败:', error);
  process.exit(1);
});
