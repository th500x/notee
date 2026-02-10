/**
 * 更新武将CSV数据
 * 
 * 功能：
 * 1. 读取 hero-template.csv
 * 2. 计算生涯（early/peak/late/death）
 * 3. 随机分配属性（基于稀有度和类型）
 * 4. 随机分配技能（基于稀有度）
 * 5. 写回 hero-template.csv
 * 
 * 使用方法：
 * node tools/update-hero-csv.cjs
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  csvPath: path.join(__dirname, 'hero-template.csv'),
  skillsPath: path.join(__dirname, '../public/data/shared/skills.json'),
  seasonYear: 184, // S1赛季年份
};

// 稀有度基础属性点数
const RARITY_BASE_POINTS = {
  core: { military: [56, 60], strategist: [56, 60], balanced: [58, 62] },
  legendary: { military: [56, 60], strategist: [56, 60], balanced: [58, 62] },
  epic: { military: [52, 56], strategist: [52, 56], balanced: [54, 58] },
  rare: { military: [48, 52], strategist: [48, 52], balanced: [50, 54] },
  common: { military: [44, 48], strategist: [44, 48], balanced: [46, 50] },
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成随机数（包含min和max）
 */
function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * 四舍五入到一位小数
 */
function roundToOne(num) {
  return Math.round(num * 10) / 10;
}

/**
 * 计算生涯
 */
function calculateStage(birthYear, deathYear, seasonYear) {
  const age = seasonYear - birthYear;
  const isDead = deathYear && seasonYear > deathYear;
  
  if (isDead) {
    return 'death'; // 💀 卒
  } else if (age < 25) {
    return 'early'; // 🌱 茅庐
  } else if (age <= 45) {
    return 'peak';  // ⭐ 巅峰
  } else {
    return 'late';  // 🧙 不惑
  }
}

/**
 * 随机分配属性
 * 
 * 完整规则（v3.2）：
 * 1. 基础属性范围：0-10
 * 2. 随机生成下限：> 3.5
 * 3. 稀有度单项属性上限：
 *    - core/legendary: 10.0
 *    - epic: < 9.5 (实际9.4)
 *    - rare: < 8.5 (实际8.4)
 *    - common: < 8.0 (实际7.9)
 * 4. 角色类型分配规则：
 *    - military: luck+courage+command+combat 占 60%-65%，各项属性差值≤3.5
 *    - strategist: luck+intelligence+politics+charisma 占 60%-65%，各项属性差值≤3.5
 *    - balanced: 7项属性差值 ≤ 2.0
 */
function generateAttributes(rarity, characterType) {
  const basePoints = RARITY_BASE_POINTS[rarity][characterType];
  const totalPoints = randomBetween(basePoints[0], basePoints[1]);
  
  // 稀有度单项属性上限
  const rarityMaxMap = {
    core: 10.0,
    legendary: 10.0,
    epic: 9.4,      // < 9.5
    rare: 8.4,      // < 8.5
    common: 7.9,    // < 8.0
  };
  const maxSingleAttr = rarityMaxMap[rarity];
  const minSingleAttr = 3.5; // 最小值
  const maxDiff = characterType === 'balanced' ? 2.0 : 3.5; // 最大差值
  
  let attributes = {
    luck: 0,
    courage: 0,
    command: 0,
    combat: 0,
    intelligence: 0,
    politics: 0,
    charisma: 0,
  };
  
  // 最多尝试50次生成符合条件的属性
  let attempts = 0;
  let isValid = false;
  
  while (!isValid && attempts < 50) {
    attempts++;
    
    if (characterType === 'military') {
      // 武官型：luck + courage + command + combat 占 60%-65%
      const primaryRatio = randomBetween(0.60, 0.65);
      const primaryTotal = totalPoints * primaryRatio;
      const secondaryTotal = totalPoints - primaryTotal;
      
      // 主要属性组（4项）：运气、勇气、统帅、武力
      // 为了控制差值，使用更均衡的权重分配
      const priWeights = [
        0.7 + Math.random() * 0.6,  // 0.7-1.3
        0.7 + Math.random() * 0.6,  // 0.7-1.3
        0.7 + Math.random() * 0.6,  // 0.7-1.3
        0.7 + Math.random() * 0.6   // 0.7-1.3
      ];
      const priSum = priWeights.reduce((a, b) => a + b, 0);
      let luck = (priWeights[0] / priSum) * primaryTotal;
      let courage = (priWeights[1] / priSum) * primaryTotal;
      let command = (priWeights[2] / priSum) * primaryTotal;
      let combat = (priWeights[3] / priSum) * primaryTotal;
      
      // 次要属性组（3项）：智力、政治、魅力
      const secWeights = [Math.random(), Math.random(), Math.random()];
      const secSum = secWeights.reduce((a, b) => a + b, 0);
      let intelligence = (secWeights[0] / secSum) * secondaryTotal;
      let politics = (secWeights[1] / secSum) * secondaryTotal;
      let charisma = (secWeights[2] / secSum) * secondaryTotal;
      
      // 应用限制
      luck = Math.max(minSingleAttr, Math.min(maxSingleAttr, luck));
      courage = Math.max(minSingleAttr, Math.min(maxSingleAttr, courage));
      command = Math.max(minSingleAttr, Math.min(maxSingleAttr, command));
      combat = Math.max(minSingleAttr, Math.min(maxSingleAttr, combat));
      intelligence = Math.max(minSingleAttr, Math.min(maxSingleAttr, intelligence));
      politics = Math.max(minSingleAttr, Math.min(maxSingleAttr, politics));
      charisma = Math.max(minSingleAttr, Math.min(maxSingleAttr, charisma));
      
      // 重新调整主要属性组以保持比例
      const actualPrimaryTotal = luck + courage + command + combat;
      const actualSecondaryTotal = intelligence + politics + charisma;
      
      // 按比例调整到目标总和
      const primaryAdjust = primaryTotal / actualPrimaryTotal;
      const secondaryAdjust = secondaryTotal / actualSecondaryTotal;
      
      attributes.luck = roundToOne(luck * primaryAdjust);
      attributes.courage = roundToOne(courage * primaryAdjust);
      attributes.command = roundToOne(command * primaryAdjust);
      attributes.combat = roundToOne(combat * primaryAdjust);
      attributes.intelligence = roundToOne(intelligence * secondaryAdjust);
      attributes.politics = roundToOne(politics * secondaryAdjust);
      attributes.charisma = roundToOne(charisma * secondaryAdjust);
      
    } else if (characterType === 'strategist') {
      // 军师型：luck + intelligence + politics + charisma 占 60%-65%
      const primaryRatio = randomBetween(0.60, 0.65);
      const primaryTotal = totalPoints * primaryRatio;
      const secondaryTotal = totalPoints - primaryTotal;
      
      // 主要属性组（4项）：运气、智力、政治、魅力
      // 为了控制差值，使用更均衡的权重分配
      const priWeights = [
        0.7 + Math.random() * 0.6,  // 0.7-1.3
        0.7 + Math.random() * 0.6,  // 0.7-1.3
        0.7 + Math.random() * 0.6,  // 0.7-1.3
        0.7 + Math.random() * 0.6   // 0.7-1.3
      ];
      const priSum = priWeights.reduce((a, b) => a + b, 0);
      let luck = (priWeights[0] / priSum) * primaryTotal;
      let intelligence = (priWeights[1] / priSum) * primaryTotal;
      let politics = (priWeights[2] / priSum) * primaryTotal;
      let charisma = (priWeights[3] / priSum) * primaryTotal;
      
      // 次要属性组（3项）：勇气、统帅、武力
      const secWeights = [Math.random(), Math.random(), Math.random()];
      const secSum = secWeights.reduce((a, b) => a + b, 0);
      let courage = (secWeights[0] / secSum) * secondaryTotal;
      let command = (secWeights[1] / secSum) * secondaryTotal;
      let combat = (secWeights[2] / secSum) * secondaryTotal;
      
      // 应用限制
      luck = Math.max(minSingleAttr, Math.min(maxSingleAttr, luck));
      intelligence = Math.max(minSingleAttr, Math.min(maxSingleAttr, intelligence));
      politics = Math.max(minSingleAttr, Math.min(maxSingleAttr, politics));
      charisma = Math.max(minSingleAttr, Math.min(maxSingleAttr, charisma));
      courage = Math.max(minSingleAttr, Math.min(maxSingleAttr, courage));
      command = Math.max(minSingleAttr, Math.min(maxSingleAttr, command));
      combat = Math.max(minSingleAttr, Math.min(maxSingleAttr, combat));
      
      // 重新调整主要属性组以保持比例
      const actualPrimaryTotal = luck + intelligence + politics + charisma;
      const actualSecondaryTotal = courage + command + combat;
      
      // 按比例调整到目标总和
      const primaryAdjust = primaryTotal / actualPrimaryTotal;
      const secondaryAdjust = secondaryTotal / actualSecondaryTotal;
      
      attributes.luck = roundToOne(luck * primaryAdjust);
      attributes.intelligence = roundToOne(intelligence * primaryAdjust);
      attributes.politics = roundToOne(politics * primaryAdjust);
      attributes.charisma = roundToOne(charisma * primaryAdjust);
      attributes.courage = roundToOne(courage * secondaryAdjust);
      attributes.command = roundToOne(command * secondaryAdjust);
      attributes.combat = roundToOne(combat * secondaryAdjust);
      
    } else { // balanced
      // 文武双全：7项属性差值 ≤ 2.0
      const avgValue = totalPoints / 7;
      
      // 生成7个随机偏移值（范围：-1.0 到 +1.0）
      const offsets = [];
      for (let i = 0; i < 7; i++) {
        offsets.push(randomBetween(-1.0, 1.0));
      }
      
      // 应用偏移值
      attributes.luck = avgValue + offsets[0];
      attributes.courage = avgValue + offsets[1];
      attributes.command = avgValue + offsets[2];
      attributes.combat = avgValue + offsets[3];
      attributes.intelligence = avgValue + offsets[4];
      attributes.politics = avgValue + offsets[5];
      attributes.charisma = avgValue + offsets[6];
      
      // 调整确保总和不变
      const currentTotal = Object.values(attributes).reduce((a, b) => a + b, 0);
      const adjustRatio = totalPoints / currentTotal;
      Object.keys(attributes).forEach(key => {
        attributes[key] = roundToOne(attributes[key] * adjustRatio);
      });
      
      // 验证差值 ≤ 2.0，如果不符合则重新调整
      let maxAttr = Math.max(...Object.values(attributes));
      let minAttr = Math.min(...Object.values(attributes));
      
      if (maxAttr - minAttr > 2.0) {
        // 压缩到差值2.0范围内
        const range = maxAttr - minAttr;
        const targetRange = 2.0;
        const compressRatio = targetRange / range;
        const center = (maxAttr + minAttr) / 2;
        
        Object.keys(attributes).forEach(key => {
          attributes[key] = roundToOne(center + (attributes[key] - center) * compressRatio);
        });
        
        // 再次调整总和
        const newTotal = Object.values(attributes).reduce((a, b) => a + b, 0);
        const finalRatio = totalPoints / newTotal;
        Object.keys(attributes).forEach(key => {
          attributes[key] = roundToOne(attributes[key] * finalRatio);
        });
      }
    }
    
    // 确保所有属性在3.5-maxSingleAttr范围内
    Object.keys(attributes).forEach(key => {
      if (attributes[key] < minSingleAttr) {
        attributes[key] = minSingleAttr;
      }
      if (attributes[key] > maxSingleAttr) {
        attributes[key] = maxSingleAttr;
      }
    });
    
    // 验证差值是否符合要求
    const values = Object.values(attributes);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const diff = maxVal - minVal;
    
    if (diff <= maxDiff) {
      isValid = true;
    }
  }
  
  return attributes;
}

/**
 * 随机分配技能
 * @param {string} rarity - 稀有度
 * @param {string} characterType - 角色类型（military/strategist/balanced）
 * @param {Array} skillsData - 技能数据数组
 */
function assignSkills(rarity, characterType, skillsData) {
  const rarityMap = {
    core: '5',
    legendary: '4',
    epic: '3',
    rare: '2',
    common: '1',
  };
  
  const rarityCode = rarityMap[rarity];
  
  // 筛选主动技能，使用正向匹配逻辑
  const activeSkills = skillsData.filter(s => {
    // 必须是对应稀有度的主动技能
    if (!s.id.startsWith(`skill_1_${rarityCode}`)) return false;
    
    // 如果技能指定了character_type，检查是否匹配
    if (s.characterType && s.characterType !== '') {
      // 支持多个类型（用逗号或分号分隔）
      const allowedTypes = s.characterType.split(/[,;]/).map(t => t.trim());
      return allowedTypes.includes(characterType);
    }
    
    // 没有指定character_type，所有类型都可用
    return true;
  });
  
  // 筛选被动技能，使用正向匹配逻辑
  const passiveSkills = skillsData.filter(s => {
    // 必须是对应稀有度的被动技能
    if (!s.id.startsWith(`skill_2_${rarityCode}`)) return false;
    
    // 如果技能指定了character_type，检查是否匹配
    if (s.characterType && s.characterType !== '') {
      // 支持多个类型（用逗号或分号分隔）
      const allowedTypes = s.characterType.split(/[,;]/).map(t => t.trim());
      return allowedTypes.includes(characterType);
    }
    
    // 没有指定character_type，所有类型都可用
    return true;
  });
  
  // 随机选择
  const skill_1 = activeSkills.length > 0 
    ? activeSkills[Math.floor(Math.random() * activeSkills.length)].id 
    : '';
  const skill_2 = passiveSkills.length > 0 
    ? passiveSkills[Math.floor(Math.random() * passiveSkills.length)].id 
    : '';
  
  return { skill_1, skill_2 };
}

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
 * 转义CSV字段（如果包含逗号或引号）
 */
function escapeCSVField(field) {
  if (!field) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 写入CSV文件
 */
function writeCSV(filePath, headers, data) {
  const lines = [];
  
  // 写入表头
  lines.push(headers.map(h => escapeCSVField(h)).join(','));
  
  // 写入数据
  data.forEach(row => {
    const values = headers.map(header => escapeCSVField(row[header] || ''));
    lines.push(values.join(','));
  });
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

// ============================================================================
// 主函数
// ============================================================================

function main() {
  console.log('='.repeat(80));
  console.log('更新武将CSV数据');
  console.log('='.repeat(80));
  console.log('');
  
  // 1. 读取技能数据
  console.log('📖 读取技能数据...');
  const skillsData = JSON.parse(fs.readFileSync(CONFIG.skillsPath, 'utf8'));
  console.log(`   ✅ 读取到 ${skillsData.length} 个技能`);
  console.log('');
  
  // 2. 读取CSV数据
  console.log('📖 读取CSV数据...');
  const { headers, data } = readCSV(CONFIG.csvPath);
  console.log(`   ✅ 读取到 ${data.length} 行数据`);
  console.log('');
  
  // 3. 更新数据
  console.log('🔄 更新数据...');
  console.log('   - 计算生涯（early/peak/late/death）');
  console.log('   - 随机分配属性（基于稀有度和类型）');
  console.log('   - 随机分配技能（基于稀有度）');
  console.log('');
  
  let updatedCount = 0;
  data.forEach(row => {
    // 只处理S1赛季的角色
    if (row.season !== 'S1') return;
    
    // 跳过没有基本信息的角色
    if (!row.character_name || !row.rarity || !row.character_type) return;
    
    // 计算生涯
    const birthYear = parseInt(row.birth_year) || 150;
    const deathYear = row.death_year ? parseInt(row.death_year) : null;
    const age = CONFIG.seasonYear - birthYear;
    const stage = calculateStage(birthYear, deathYear, CONFIG.seasonYear);
    
    // 随机生成属性
    const attributes = generateAttributes(row.rarity, row.character_type);
    
    // 随机分配技能
    const skills = assignSkills(row.rarity, row.character_type, skillsData);
    
    // 更新行数据
    row.age = age.toString();
    row.stage = stage;
    row.luck = attributes.luck.toString();
    row.courage = attributes.courage.toString();
    row.command = attributes.command.toString();
    row.combat = attributes.combat.toString();
    row.intelligence = attributes.intelligence.toString();
    row.politics = attributes.politics.toString();
    row.charisma = attributes.charisma.toString();
    row.skill_1 = skills.skill_1;
    row.skill_2 = skills.skill_2;
    
    updatedCount++;
  });
  
  console.log(`   ✅ 更新了 ${updatedCount} 个角色`);
  console.log('');
  
  // 4. 写回CSV文件
  console.log('💾 保存CSV文件...');
  writeCSV(CONFIG.csvPath, headers, data);
  console.log(`   ✅ 已保存到：${CONFIG.csvPath}`);
  console.log('');
  
  // 5. 显示统计
  console.log('-'.repeat(80));
  console.log('📊 数据统计：');
  console.log('');
  
  const s1Characters = data.filter(row => row.season === 'S1' && row.character_name && row.rarity);
  
  // 按生涯统计
  const stageStats = {};
  s1Characters.forEach(row => {
    stageStats[row.stage] = (stageStats[row.stage] || 0) + 1;
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
  const examples = s1Characters.slice(0, 3);
  examples.forEach(row => {
    const total = (
      parseFloat(row.luck) + 
      parseFloat(row.courage) + 
      parseFloat(row.command) + 
      parseFloat(row.combat) + 
      parseFloat(row.intelligence) + 
      parseFloat(row.politics) + 
      parseFloat(row.charisma)
    ).toFixed(1);
    console.log(`  ${row.character_name} (${row.rarity}, ${row.character_type})`);
    console.log(`    生涯: ${stageNames[row.stage]} (${row.age}岁)`);
    console.log(`    属性: 总计${total} (运${row.luck} 勇${row.courage} 统${row.command} 武${row.combat} 智${row.intelligence} 政${row.politics} 魅${row.charisma})`);
    console.log(`    技能: ${row.skill_1}, ${row.skill_2}`);
    console.log('');
  });
  
  console.log('-'.repeat(80));
  console.log('');
  console.log('✅ 更新完成！');
  console.log('');
  console.log('💡 提示：现在可以运行 node tools/hero-csv-to-json.cjs 生成JSON文件');
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
