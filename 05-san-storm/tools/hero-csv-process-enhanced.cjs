/**
 * 武将CSV处理增强工具
 * 
 * 功能：
 * 1. 根据年龄自动判断stage（茅庐/巅峰/不惑）
 * 2. 为空属性的角色生成符合规则的属性
 * 3. 验证所有角色属性是否符合规则
 * 4. 输出处理后的CSV
 * 
 * 使用方法：
 * node tools/hero-csv-process-enhanced.cjs
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  inputCSV: path.join(__dirname, 'hero-template.csv'),
  outputCSV: path.join(__dirname, 'hero-template-processed.csv'),
};

// ============================================================================
// 阶段判断规则
// ============================================================================

/**
 * 根据年龄判断stage
 * @param {number} age - 年龄
 * @returns {string} - 'early', 'peak', 'late'
 */
function determineStage(age) {
  if (age <= 22) return 'early';  // 茅庐：22岁及以下
  if (age <= 45) return 'peak';   // 巅峰：23-45岁
  return 'late';                   // 不惑：46岁及以上
  // 注意：'dead'（卒）状态需要手动设置，不能通过年龄自动判断
}

// ============================================================================
// 属性生成规则
// ============================================================================

/**
 * 获取基础属性点范围
 */
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

/**
 * 获取阶段修正
 */
function getStageModifier(stage) {
  const modifiers = {
    early: 0.95,  // 茅庐：-5%
    peak: 1.0,    // 巅峰：无修正
    late: 0.90,   // 不惑：-10%
    dead: 0.80    // 卒：-20%
  };
  return modifiers[stage] || 1.0;
}

/**
 * 获取单项属性上限（根据稀有度）
 */
function getMaxAttributeByRarity(rarity) {
  const maxAttributes = {
    core: 10.0,        // 核心：无上限（10.0）
    legendary: 10.0,   // 传奇：无上限（10.0）
    epic: 9.5,         // 史诗：< 9.5
    rare: 8.5,         // 稀有：< 8.5
    common: 8.0,       // 普通：< 8.0
  };
  return maxAttributes[rarity] || 10.0;
}

/**
 * 生成随机属性值
 */
function generateAttributes(rarity, stage, characterType) {
  // 1. 确定总属性点
  const [minBase, maxBase] = getBaseAttributeRange(rarity, characterType);
  const basePoints = minBase + Math.random() * (maxBase - minBase);
  const modifier = getStageModifier(stage);
  const totalPoints = basePoints * modifier;
  
  // 2. 根据类型分配属性
  let attributes;
  
  if (characterType === 'military') {
    attributes = generateMilitaryAttributes(totalPoints, rarity);
  } else if (characterType === 'strategist') {
    attributes = generateStrategistAttributes(totalPoints, rarity);
  } else {
    attributes = generateBalancedAttributes(totalPoints, rarity);
  }
  
  return attributes;
}

/**
 * 生成武官型属性
 */
function generateMilitaryAttributes(totalPoints, rarity) {
  // 获取单项属性上限
  const maxAttr = getMaxAttributeByRarity(rarity);
  
  // 武官型：武力组 = 智力组 × 120%-150%
  // 武力组：command + combat
  // 智力组：intelligence + politics + charisma
  
  // 先分配运气和勇气（占总点数的25%-30%）
  const luck = Math.min(3.0 + Math.random() * 5.0, maxAttr); // 3.0-8.0，不超过上限
  const courage = Math.min(8.0 + Math.random() * 1.8, maxAttr); // 8.0-9.8，不超过上限
  
  // 剩余点数分配给武力组和智力组
  const remainingPoints = totalPoints - luck - courage;
  
  // 武力组占剩余点数的55%-60%
  const militaryRatio = 0.55 + Math.random() * 0.05;
  const militaryPoints = remainingPoints * militaryRatio;
  const intellectPoints = remainingPoints * (1 - militaryRatio);
  
  // 分配武力组（确保不超过上限）
  const commandTarget = 7.0 + Math.random() * 3.0;
  const command = Math.min(commandTarget, maxAttr);
  const combat = Math.min(militaryPoints - command, maxAttr);
  
  // 分配智力组（确保不超过上限，且至少3.0）
  const intelligenceTarget = 4.0 + Math.random() * 3.0;
  const intelligence = Math.max(3.0, Math.min(intelligenceTarget, maxAttr));
  
  const politicsTarget = 4.0 + Math.random() * 2.5;
  const politics = Math.max(3.0, Math.min(politicsTarget, maxAttr));
  
  const charismaTarget = intellectPoints - intelligence - politics;
  const charisma = Math.max(3.0, Math.min(charismaTarget, maxAttr));
  
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

/**
 * 生成军师型属性
 */
function generateStrategistAttributes(totalPoints, rarity) {
  // 获取单项属性上限
  const maxAttr = getMaxAttributeByRarity(rarity);
  
  // 军师型：智力组 = 武力组 × 120%-150%
  
  // 先分配运气和勇气（占总点数的20%-25%）
  const luck = Math.max(3.0, Math.min(5.0 + Math.random() * 3.0, maxAttr)); // 5.0-8.0
  const courage = Math.max(3.0, Math.min(4.0 + Math.random() * 3.0, maxAttr)); // 4.0-7.0
  
  // 剩余点数分配给武力组和智力组
  const remainingPoints = totalPoints - luck - courage;
  
  // 智力组占剩余点数的60%-65%
  const intellectRatio = 0.60 + Math.random() * 0.05;
  const intellectPoints = remainingPoints * intellectRatio;
  const militaryPoints = remainingPoints * (1 - intellectRatio);
  
  // 分配智力组（确保不超过上限）
  const intelligenceTarget = 7.0 + Math.random() * 2.0;
  const intelligence = Math.min(intelligenceTarget, maxAttr);
  
  const politicsTarget = 6.0 + Math.random() * 2.5;
  const politics = Math.min(politicsTarget, maxAttr);
  
  const charismaTarget = intellectPoints - intelligence - politics;
  const charisma = Math.max(3.0, Math.min(charismaTarget, maxAttr));
  
  // 分配武力组（确保至少3.0）
  const commandTarget = 5.0 + Math.random() * 3.0;
  const command = Math.max(3.0, Math.min(commandTarget, maxAttr));
  
  const combatTarget = militaryPoints - command;
  const combat = Math.max(3.0, Math.min(combatTarget, maxAttr));
  
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

/**
 * 生成文武双全型属性
 */
function generateBalancedAttributes(totalPoints, rarity) {
  // 获取单项属性上限
  const maxAttr = getMaxAttributeByRarity(rarity);
  
  // 文武双全：属性较为均衡
  
  const luck = Math.max(3.0, Math.min(6.0 + Math.random() * 3.0, maxAttr)); // 6.0-9.0
  const courage = Math.max(3.0, Math.min(6.0 + Math.random() * 3.0, maxAttr)); // 6.0-9.0
  
  const remainingPoints = totalPoints - luck - courage;
  const avgPoint = remainingPoints / 5;
  
  // 在平均值附近随机（确保不超过上限且至少3.0）
  const command = Math.max(3.0, Math.min(avgPoint + (Math.random() - 0.5) * 2, maxAttr));
  const combat = Math.max(3.0, Math.min(avgPoint + (Math.random() - 0.5) * 2, maxAttr));
  const intelligence = Math.max(3.0, Math.min(avgPoint + (Math.random() - 0.5) * 2, maxAttr));
  const politics = Math.max(3.0, Math.min(avgPoint + (Math.random() - 0.5) * 2, maxAttr));
  const charisma = Math.max(3.0, Math.min(remainingPoints - command - combat - intelligence - politics, maxAttr));
  
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

// ============================================================================
// CSV处理
// ============================================================================

/**
 * 读取CSV文件
 */
function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  const headers = lines[0].split(',');
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length >= headers.length && values[1]) { // 确保有name
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
  }
  
  return { headers, data };
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
 * 处理单行数据
 */
function processRow(row) {
  // 跳过非S1赛季或空行
  if (row.season !== 'S1' || !row.character_name || !row.rarity) {
    return row;
  }
  
  // 1. 判断stage
  if (!row.stage && row.age) {
    const age = parseInt(row.age);
    row.stage = determineStage(age);
  }
  
  // 2. 生成属性（如果为空）
  const hasAttributes = row.luck && row.courage && row.command && row.combat && 
                       row.intelligence && row.politics && row.charisma;
  
  if (!hasAttributes && row.CHARACTER_TYPES) {
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

/**
 * 写入CSV文件
 */
function writeCSV(filePath, headers, data) {
  const lines = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = String(row[header] || '');
      // 如果包含逗号或引号，需要用引号包裹
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
// 验证函数
// ============================================================================

/**
 * 验证角色属性
 */
function validateCharacter(row) {
  if (row.season !== 'S1' || !row.character_name) {
    return { valid: true, message: '跳过' };
  }
  
  // 检查必要字段
  if (!row.rarity || !row.CHARACTER_TYPES || !row.stage) {
    return { valid: false, message: '缺少必要字段' };
  }
  
  // 检查属性
  const attrs = ['luck', 'courage', 'command', 'combat', 'intelligence', 'politics', 'charisma'];
  const hasAllAttrs = attrs.every(attr => row[attr]);
  
  if (!hasAllAttrs) {
    return { valid: false, message: '缺少属性值' };
  }
  
  // 计算总属性点
  const total = attrs.reduce((sum, attr) => sum + parseFloat(row[attr] || 0), 0);
  
  // 获取期望范围
  const [minBase, maxBase] = getBaseAttributeRange(row.rarity, row.CHARACTER_TYPES);
  const modifier = getStageModifier(row.stage);
  const minExpected = minBase * modifier;
  const maxExpected = maxBase * modifier;
  
  // 验证总属性点（允许±2的误差）
  if (total < minExpected - 2 || total > maxExpected + 2) {
    return {
      valid: false,
      message: `总属性点${total.toFixed(1)}不在期望范围${minExpected.toFixed(1)}-${maxExpected.toFixed(1)}内`,
      total,
      expected: `${minExpected.toFixed(1)}-${maxExpected.toFixed(1)}`,
    };
  }
  
  return { valid: true, message: '通过', total: total.toFixed(1) };
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('武将CSV处理增强工具');
  console.log('='.repeat(80));
  console.log('');
  
  // 1. 读取CSV
  console.log('📖 读取CSV数据...');
  const { headers, data } = readCSV(CONFIG.inputCSV);
  console.log(`   ✅ 读取到 ${data.length} 行数据\n`);
  
  // 2. 处理数据
  console.log('⚙️  处理数据...');
  let processedCount = 0;
  let stageCount = 0;
  let attrCount = 0;
  
  const processedData = data.map(row => {
    const originalStage = row.stage;
    const hasOriginalAttrs = row.luck && row.courage;
    
    const processed = processRow(row);
    
    if (processed.season === 'S1' && processed.name) {
      processedCount++;
      if (!originalStage && processed.stage) {
        stageCount++;
      }
      if (!hasOriginalAttrs && processed.luck) {
        attrCount++;
      }
    }
    
    return processed;
  });
  
  console.log(`   ✅ 处理了 ${processedCount} 个角色`);
  console.log(`   ✅ 自动判断stage: ${stageCount} 个`);
  console.log(`   ✅ 生成属性: ${attrCount} 个\n`);
  
  // 3. 验证数据
  console.log('🔍 验证数据...');
  const errors = [];
  const warnings = [];
  
  processedData.forEach(row => {
    const validation = validateCharacter(row);
    if (!validation.valid) {
      errors.push({
        name: row.character_name,
        message: validation.message,
        total: validation.total,
        expected: validation.expected,
      });
    }
  });
  
  if (errors.length === 0) {
    console.log(`   ✅ 所有角色验证通过！\n`);
  } else {
    console.log(`   ⚠️  发现 ${errors.length} 个错误：\n`);
    errors.forEach(err => {
      console.log(`   ❌ ${err.name}: ${err.message}`);
      if (err.total) {
        console.log(`      实际: ${err.total}, 期望: ${err.expected}`);
      }
    });
    console.log('');
  }
  
  // 4. 保存处理后的CSV
  console.log('💾 保存处理后的CSV...');
  writeCSV(CONFIG.outputCSV, headers, processedData);
  console.log(`   ✅ 已保存到：${CONFIG.outputCSV}\n`);
  
  // 5. 统计信息
  console.log('-'.repeat(80));
  console.log('📊 统计信息：\n');
  
  const s1Characters = processedData.filter(r => r.season === 'S1' && r.name);
  
  // 按阶段统计
  const stageStats = {
    early: s1Characters.filter(r => r.stage === 'early').length,
    peak: s1Characters.filter(r => r.stage === 'peak').length,
    late: s1Characters.filter(r => r.stage === 'late').length,
  };
  
  console.log('阶段分布：');
  console.log(`  茅庐(early): ${stageStats.early} 个`);
  console.log(`  巅峰(peak): ${stageStats.peak} 个`);
  console.log(`  不惑(late): ${stageStats.late} 个`);
  console.log('');
  
  // 按稀有度统计
  const rarityStats = {};
  s1Characters.forEach(r => {
    rarityStats[r.rarity] = (rarityStats[r.rarity] || 0) + 1;
  });
  
  console.log('稀有度分布：');
  Object.entries(rarityStats).forEach(([rarity, count]) => {
    console.log(`  ${rarity}: ${count} 个`);
  });
  console.log('');
  
  console.log(`总计: ${s1Characters.length} 个S1角色`);
  console.log('');
  console.log('-'.repeat(80));
  console.log('');
  console.log('✅ 处理完成！');
  console.log('');
  console.log('下一步：');
  console.log('1. 检查 hero-template-processed.csv');
  console.log('2. 如果满意，替换原文件：');
  console.log('   copy hero-template-processed.csv hero-template.csv');
  console.log('3. 运行转换工具生成JSON：');
  console.log('   node tools/hero-csv-to-json.cjs');
  console.log('');
  console.log('='.repeat(80));
}

// 运行
main().catch(error => {
  console.error('处理失败:', error);
  process.exit(1);
});
