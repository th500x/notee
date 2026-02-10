/**
 * 处理武将数据工具
 * 1. 根据年龄判断 stage
 * 2. 根据 rarity 和 CHARACTER_TYPES 生成合理的属性值
 * 3. 填充缺失的属性数据
 */

const fs = require('fs');
const path = require('path');

// 读取CSV文件
function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const headers = lines[0].split(',');
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length && values[1]) { // 确保有name
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }
  }
  
  return { headers, data };
}

// 解析CSV行（处理逗号）
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

// 根据年龄判断 stage
function determineStage(age) {
  if (age <= 25) {
    return '茅庐'; // early
  } else if (age <= 45) {
    return '巅峰'; // peak
  } else {
    return '不惑'; // late
  }
}

// 获取属性范围
function getAttributeRange(rarity, stage, characterType) {
  // 基础范围
  const baseRanges = {
    core: { military: [50, 60], strategist: [50, 60], balanced: [52, 62] },
    legendary: { military: [56, 60], strategist: [56, 60], balanced: [58, 62] },
    epic: { military: [52, 56], strategist: [52, 56], balanced: [54, 58] },
    rare: { military: [48, 52], strategist: [48, 52], balanced: [50, 54] },
    common: { military: [44, 48], strategist: [44, 48], balanced: [46, 50] },
  };

  // 阶段修正
  const stageModifiers = {
    '巅峰': 1.0,
    '茅庐': 0.95,
    '不惑': 0.90,
  };

  const [min, max] = baseRanges[rarity]?.[characterType] || [44, 48];
  const modifier = stageModifiers[stage] || 1.0;

  return {
    min: min * modifier,
    max: max * modifier,
  };
}

// 生成属性值
function generateAttributes(character) {
  const { rarity, stage, CHARACTER_TYPES, name } = character;
  
  if (!rarity || !CHARACTER_TYPES) {
    return null;
  }
  
  // 获取属性范围
  const range = getAttributeRange(rarity, stage, CHARACTER_TYPES);
  const targetTotal = (range.min + range.max) / 2;
  
  // 初始化属性
  const attributes = {
    luck: 5.0,
    courage: 5.0,
    command: 5.0,
    combat: 5.0,
    intelligence: 5.0,
    politics: 5.0,
    charisma: 5.0,
  };
  
  let remainingPoints = targetTotal - 35.0; // 7个属性，基础5.0
  
  // 根据类型分配属性
  if (CHARACTER_TYPES === 'military') {
    // 武官型：武力组 = 智力组 × 1.3 (120%-150%的中间值)
    // 设武力组为x，智力组为y，则 x = 1.3y
    // x + y = remainingPoints
    // 1.3y + y = remainingPoints
    // y = remainingPoints / 2.3
    const intellectSum = remainingPoints / 2.3;
    const militarySum = remainingPoints - intellectSum;
    
    // 武力组分配
    attributes.command += militarySum * 0.52;
    attributes.combat += militarySum * 0.48;
    
    // 智力组分配
    attributes.intelligence += intellectSum * 0.25;
    attributes.politics += intellectSum * 0.20;
    attributes.charisma += intellectSum * 0.25;
    
    // 其他属性
    attributes.courage += intellectSum * 0.20;
    attributes.luck += intellectSum * 0.10;
    
  } else if (CHARACTER_TYPES === 'strategist') {
    // 军师型：智力组 = 武力组 × 1.3 (120%-150%的中间值)
    // 设智力组为x，武力组为y，则 x = 1.3y
    // x + y = remainingPoints
    // 1.3y + y = remainingPoints
    // y = remainingPoints / 2.3
    const militarySum = remainingPoints / 2.3;
    const intellectSum = remainingPoints - militarySum;
    
    // 智力组分配
    attributes.intelligence += intellectSum * 0.40;
    attributes.politics += intellectSum * 0.35;
    attributes.charisma += intellectSum * 0.25;
    
    // 武力组分配
    attributes.command += militarySum * 0.55;
    attributes.combat += militarySum * 0.25;
    
    // 其他属性
    attributes.luck += militarySum * 0.12;
    attributes.courage += militarySum * 0.08;
    
  } else if (CHARACTER_TYPES === 'balanced') {
    // 文武双全：均衡分配
    const avgBonus = remainingPoints / 7;
    attributes.command += avgBonus * 1.2;
    attributes.intelligence += avgBonus * 1.2;
    attributes.politics += avgBonus * 1.1;
    attributes.charisma += avgBonus * 1.1;
    attributes.combat += avgBonus * 0.9;
    attributes.courage += avgBonus * 0.8;
    attributes.luck += avgBonus * 0.7;
  }
  
  // 添加随机性（±0.5）
  Object.keys(attributes).forEach(key => {
    attributes[key] += (Math.random() - 0.5) * 1.0;
  });
  
  // 四舍五入到小数点后一位
  Object.keys(attributes).forEach(key => {
    attributes[key] = Math.round(attributes[key] * 10) / 10;
    // 确保在0-10范围内
    attributes[key] = Math.max(0, Math.min(10, attributes[key]));
  });
  
  return attributes;
}

// 处理单个角色
function processCharacter(character) {
  // 1. 判断 stage
  if (character.age && !character.stage) {
    character.stage = determineStage(parseInt(character.age));
  }
  
  // 2. 如果缺少属性，生成属性
  const hasAttributes = character.luck || character.courage || character.command;
  
  if (!hasAttributes && character.rarity && character.CHARACTER_TYPES) {
    const attributes = generateAttributes(character);
    if (attributes) {
      Object.assign(character, attributes);
    }
  }
  
  return character;
}

// 主函数
function main() {
  console.log('='.repeat(80));
  console.log('处理武将数据');
  console.log('='.repeat(80));
  console.log('');
  
  // 读取CSV
  const csvPath = path.join(__dirname, 'hero-template.csv');
  const { headers, data } = readCSV(csvPath);
  
  console.log(`读取到 ${data.length} 个角色`);
  console.log('');
  
  // 统计
  let stageAdded = 0;
  let attributesAdded = 0;
  
  // 处理每个角色
  data.forEach(character => {
    const originalStage = character.stage;
    const originalAttributes = character.luck;
    
    processCharacter(character);
    
    if (!originalStage && character.stage) {
      stageAdded++;
    }
    
    if (!originalAttributes && character.luck) {
      attributesAdded++;
      console.log(`✅ 生成属性：${character.name} (${character.rarity}, ${character.stage}, ${character.CHARACTER_TYPES})`);
    }
  });
  
  console.log('');
  console.log('-'.repeat(80));
  console.log(`添加 stage：${stageAdded} 个`);
  console.log(`生成属性：${attributesAdded} 个`);
  console.log('-'.repeat(80));
  console.log('');
  
  // 写回CSV
  const outputLines = [headers.join(',')];
  
  data.forEach(character => {
    const values = headers.map(header => {
      const value = character[header] || '';
      // 如果值包含逗号，用引号包裹
      if (value.toString().includes(',')) {
        return `"${value}"`;
      }
      return value;
    });
    outputLines.push(values.join(','));
  });
  
  const outputPath = path.join(__dirname, 'hero-template-processed.csv');
  fs.writeFileSync(outputPath, outputLines.join('\n'), 'utf8');
  
  console.log(`✅ 处理完成，输出文件：${outputPath}`);
  console.log('');
  console.log('='.repeat(80));
}

// 运行
main();
