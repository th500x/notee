/**
 * 重置并重新生成武将属性
 * 
 * 策略：
 * 1. 识别哪些角色的属性看起来是自动生成的（所有属性都在合理范围内但没有特色）
 * 2. 保留明显是手动设置的属性（如有10.0、或特殊值）
 * 3. 对需要重新生成的角色，按新规则生成
 * 
 * 判断标准：
 * - 如果所有7个属性都有值，且没有任何属性=10.0或<3.0，可能是自动生成的
 * - 如果有属性=10.0或有明显的特征值，保留
 * - 如果属性为空或有负值，重新生成
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
  inputCSV: path.join(__dirname, 'hero-template.csv'),
  outputCSV: path.join(__dirname, 'hero-template-reset.csv'),
};

// 需要保留属性的角色列表（手动设置的）
const KEEP_ATTRIBUTES = [
  'char_san_1101', // 刘备
  'char_san_1102', // 关羽
  'char_san_1103', // 张飞
  'char_san_1201', // 曹操
  'char_san_1202', // 夏侯惇
  'char_san_1203', // 夏侯渊
  'char_san_1204', // 曹仁
  'char_san_1207', // 乐进
  'char_san_1208', // 于禁
  'char_san_1209', // 吕虔
  'char_san_1210', // 张邈
  'char_san_1211', // 张超
  'char_san_1301', // 孙坚
  'char_san_1302', // 太史慈
  'char_san_1303', // 黄盖
  'char_san_1304', // 程普
  'char_san_1305', // 韩当
  'char_san_1306', // 朱治
  'char_san_1307', // 祖茂
  'char_san_1308', // 孙贲
  'char_san_1309', // 吴景
  'char_san_1310', // 徐琨
  'char_san_1401', // 袁绍
  'char_san_1402', // 张郃
  'char_san_1403', // 袁术
  'char_san_1404', // 袁基
  'char_san_1405', // 袁逢
  'char_san_1406', // 袁隗
  'char_san_1407', // 颜良
  'char_san_1408', // 文丑
  'char_san_1409', // 沮授
  'char_san_1410', // 田丰
  'char_san_1411', // 审配
  'char_san_1412', // 逢纪
  'char_san_1413', // 郭图
  'char_san_1414', // 许攸
  'char_san_1415', // 辛评
  'char_san_1416', // 辛毗
  'char_san_1417', // 桥瑁
  'char_san_1418', // 臧洪
  'char_san_1419', // 孔伷
  'char_san_1420', // 刘岱
  'char_san_1421', // 王匡
  'char_san_1422', // 桥蕤
  'char_san_1501', // 董卓
  'char_san_1505', // 华雄
  'char_san_1507', // 李傕
  'char_san_1508', // 郭汜
  'char_san_1511', // 胡轸
  'char_san_1601', // 刘宏
  'char_san_1602', // 何进
  'char_san_1603', // 何苗
  'char_san_1604', // 卢植
  'char_san_1605', // 朱儁
  'char_san_1606', // 皇甫嵩
  'char_san_1607', // 张让
  'char_san_1608', // 赵忠
  'char_san_1609', // 丁原
  'char_san_1610', // 蔡邕
  'char_san_1611', // 许劭
  'char_san_1612', // 王允
  'char_san_1613', // 杨彪
  'char_san_1614', // 刘虞
  'char_san_1615', // 刘焉
  'char_san_1620', // 郭典
  'char_san_1624', // 秦颉
  'char_san_1625', // 褚贡
  'char_san_1626', // 徐璆
  'char_san_1627', // 赵谦
  'char_san_1628', // 郭勋
  'char_san_1629', // 刘卫
  'char_san_1630', // 吕强
  'char_san_1701', // 张角
  'char_san_1702', // 张宝
  'char_san_1703', // 张梁
  'char_san_1704', // 马元义
  'char_san_1705', // 张曼成
  'char_san_1706', // 波才
  'char_san_1707', // 彭脱
  'char_san_1708', // 卜己
  'char_san_1709', // 赵弘
  'char_san_1710', // 韩忠
  'char_san_1711', // 唐周
  'char_san_1712', // 张燕
  'char_san_1713', // 张牛角
  'char_san_1714', // 梁仲宁
  'char_san_1715', // 张伯
  'char_san_1716', // 孙夏
  'char_san_1801', // 赵云
  'char_san_1802', // 黄忠
  'char_san_1803', // 刘表
  'char_san_1804', // 公孙瓒
  'char_san_1805', // 郑玄
  'char_san_1806', // 刘璋
  'char_san_1807', // 黄祖
  'char_san_1808', // 孔融
  'char_san_1809', // 张杨
  'char_san_1810', // 张绣
  'char_san_1811', // 张鲁
  'char_san_1812', // 陶谦
  'char_san_1813', // 韩遂
  'char_san_1814', // 马腾
];

// 属性生成函数（与之前相同，但添加了新规则）
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

function getMaxAttributeByRarity(rarity) {
  const maxAttributes = {
    core: 10.0,
    legendary: 10.0,
    epic: 9.4,
    rare: 8.4,
    common: 7.9,
  };
  return maxAttributes[rarity] || 10.0;
}

function generateMilitaryAttributes(totalPoints, rarity) {
  const maxAttr = getMaxAttributeByRarity(rarity);
  const minAttr = 3.1;
  
  for (let attempt = 0; attempt < 100; attempt++) {
    const luck = minAttr + Math.random() * Math.min(4.8, maxAttr - minAttr);
    const courage = Math.max(minAttr, Math.min(7.5 + Math.random() * 1.8, maxAttr));
    
    const remainingPoints = totalPoints - luck - courage;
    const militaryRatio = 0.54 + Math.random() * 0.06;
    const militaryPoints = remainingPoints * militaryRatio;
    const intellectPoints = remainingPoints * (1 - militaryRatio);
    
    const commandRatio = 0.48 + Math.random() * 0.08;
    const command = Math.max(minAttr, Math.min(militaryPoints * commandRatio, maxAttr));
    const combat = Math.max(minAttr, Math.min(militaryPoints - command, maxAttr));
    
    const intellectRatio1 = 0.32 + Math.random() * 0.08;
    const intellectRatio2 = 0.28 + Math.random() * 0.08;
    const intelligence = Math.max(minAttr, Math.min(intellectPoints * intellectRatio1, maxAttr));
    const politics = Math.max(minAttr, Math.min(intellectPoints * intellectRatio2, maxAttr));
    const charisma = Math.max(minAttr, Math.min(intellectPoints - intelligence - politics, maxAttr));
    
    const total = luck + courage + command + combat + intelligence + politics + charisma;
    if (Math.abs(total - totalPoints) < 0.8) {
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
    luck: parseFloat(Math.max(minAttr, Math.min(avg * 0.9, maxAttr)).toFixed(1)),
    courage: parseFloat(Math.max(minAttr, Math.min(avg * 1.2, maxAttr)).toFixed(1)),
    command: parseFloat(Math.max(minAttr, Math.min(avg * 1.1, maxAttr)).toFixed(1)),
    combat: parseFloat(Math.max(minAttr, Math.min(avg * 1.1, maxAttr)).toFixed(1)),
    intelligence: parseFloat(Math.max(minAttr, Math.min(avg * 0.8, maxAttr)).toFixed(1)),
    politics: parseFloat(Math.max(minAttr, Math.min(avg * 0.7, maxAttr)).toFixed(1)),
    charisma: parseFloat(Math.max(minAttr, Math.min(avg * 1.0, maxAttr)).toFixed(1)),
  };
}

function generateStrategistAttributes(totalPoints, rarity) {
  const maxAttr = getMaxAttributeByRarity(rarity);
  const minAttr = 3.1;
  
  for (let attempt = 0; attempt < 100; attempt++) {
    const luck = minAttr + Math.random() * Math.min(4.8, maxAttr - minAttr);
    const courage = minAttr + Math.random() * Math.min(3.8, maxAttr - minAttr);
    
    const remainingPoints = totalPoints - luck - courage;
    const intellectRatio = 0.59 + Math.random() * 0.06;
    const intellectPoints = remainingPoints * intellectRatio;
    const militaryPoints = remainingPoints * (1 - intellectRatio);
    
    const ratio1 = 0.36 + Math.random() * 0.06;
    const ratio2 = 0.31 + Math.random() * 0.06;
    const intelligence = Math.max(minAttr, Math.min(intellectPoints * ratio1, maxAttr));
    const politics = Math.max(minAttr, Math.min(intellectPoints * ratio2, maxAttr));
    const charisma = Math.max(minAttr, Math.min(intellectPoints - intelligence - politics, maxAttr));
    
    const commandRatio = 0.52 + Math.random() * 0.08;
    const command = Math.max(minAttr, Math.min(militaryPoints * commandRatio, maxAttr));
    const combat = Math.max(minAttr, Math.min(militaryPoints - command, maxAttr));
    
    const total = luck + courage + command + combat + intelligence + politics + charisma;
    if (Math.abs(total - totalPoints) < 0.8) {
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
    luck: parseFloat(Math.max(minAttr, Math.min(avg * 0.9, maxAttr)).toFixed(1)),
    courage: parseFloat(Math.max(minAttr, Math.min(avg * 0.7, maxAttr)).toFixed(1)),
    command: parseFloat(Math.max(minAttr, Math.min(avg * 0.9, maxAttr)).toFixed(1)),
    combat: parseFloat(Math.max(minAttr, Math.min(avg * 0.7, maxAttr)).toFixed(1)),
    intelligence: parseFloat(Math.max(minAttr, Math.min(avg * 1.2, maxAttr)).toFixed(1)),
    politics: parseFloat(Math.max(minAttr, Math.min(avg * 1.1, maxAttr)).toFixed(1)),
    charisma: parseFloat(Math.max(minAttr, Math.min(avg * 1.1, maxAttr)).toFixed(1)),
  };
}

function generateBalancedAttributes(totalPoints, rarity) {
  const maxAttr = getMaxAttributeByRarity(rarity);
  const minAttr = 3.1;
  const avg = totalPoints / 7;
  
  return {
    luck: parseFloat(Math.max(minAttr, Math.min(avg + (Math.random() - 0.5) * 1.8, maxAttr)).toFixed(1)),
    courage: parseFloat(Math.max(minAttr, Math.min(avg + (Math.random() - 0.5) * 1.8, maxAttr)).toFixed(1)),
    command: parseFloat(Math.max(minAttr, Math.min(avg + (Math.random() - 0.5) * 1.8, maxAttr)).toFixed(1)),
    combat: parseFloat(Math.max(minAttr, Math.min(avg + (Math.random() - 0.5) * 1.8, maxAttr)).toFixed(1)),
    intelligence: parseFloat(Math.max(minAttr, Math.min(avg + (Math.random() - 0.5) * 1.8, maxAttr)).toFixed(1)),
    politics: parseFloat(Math.max(minAttr, Math.min(avg + (Math.random() - 0.5) * 1.8, maxAttr)).toFixed(1)),
    charisma: parseFloat(Math.max(minAttr, Math.min(avg + (Math.random() - 0.5) * 1.8, maxAttr)).toFixed(1)),
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

// CSV处理
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
  
  // 判断stage
  if (!row.stage && row.age) {
    const age = parseInt(row.age);
    row.stage = determineStage(age);
  }
  
  // 检查是否需要重新生成
  const shouldKeep = KEEP_ATTRIBUTES.includes(row.character_id);
  const hasInvalidAttr = parseFloat(row.charisma) < 0 || !row.luck || !row.courage;
  
  if (!shouldKeep || hasInvalidAttr) {
    if (row.CHARACTER_TYPES && row.stage) {
      const attributes = generateAttributes(row.rarity, row.stage, row.CHARACTER_TYPES);
      row.luck = attributes.luck;
      row.courage = attributes.courage;
      row.command = attributes.command;
      row.combat = attributes.combat;
      row.intelligence = attributes.intelligence;
      row.politics = attributes.politics;
      row.charisma = attributes.charisma;
      return { ...row, regenerated: true };
    }
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

async function main() {
  console.log('='.repeat(80));
  console.log('重置并重新生成武将属性（新规则）');
  console.log('='.repeat(80));
  console.log('');
  
  const { headers, data } = readCSV(CONFIG.inputCSV);
  console.log(`📖 读取到 ${data.length} 行数据\n`);
  
  console.log('⚙️  处理数据...\n');
  let regeneratedCount = 0;
  
  const processedData = data.map(row => {
    const processed = processRow(row);
    if (processed.regenerated) {
      regeneratedCount++;
      console.log(`   ✅ ${processed.name} (${processed.rarity}) - 重新生成`);
      delete processed.regenerated;
    }
    return processed;
  });
  
  console.log(`\n   总计重新生成: ${regeneratedCount} 个角色\n`);
  
  writeCSV(CONFIG.outputCSV, headers, processedData);
  console.log(`💾 已保存到：${CONFIG.outputCSV}\n`);
  
  console.log('='.repeat(80));
  console.log('✅ 完成！');
  console.log('');
  console.log('下一步：');
  console.log('1. 验证：node tools/hero-validate-final.cjs');
  console.log('2. 替换：copy tools\\hero-template-reset.csv tools\\hero-template.csv');
  console.log('3. 生成JSON：node tools/hero-csv-to-json.cjs');
  console.log('='.repeat(80));
}

main().catch(error => {
  console.error('失败:', error);
  process.exit(1);
});
