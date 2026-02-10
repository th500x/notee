/**
 * 角色属性验证工具
 * 用于验证 characters.json 中的角色属性是否符合规则
 */

const fs = require('fs');
const path = require('path');

// 读取角色数据
const charactersPath = path.join(__dirname, '../public/data/shared/characters.json');
const charactersData = JSON.parse(fs.readFileSync(charactersPath, 'utf8'));

/**
 * 获取期望属性范围
 */
function getExpectedAttributeRange(rarity, stage, characterType) {
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
    巅峰: 1.0,
    peak: 1.0,
    茅庐: 0.95,
    early: 0.95,
    不惑: 0.90,
    late: 0.90,
  };

  const [min, max] = baseRanges[rarity]?.[characterType] || [0, 100];
  const modifier = stageModifiers[stage] || 1.0;

  return {
    min: min * modifier,
    max: max * modifier,
  };
}

/**
 * 推断角色类型（如果未指定）
 */
function inferCharacterType(character) {
  if (character.characterType) {
    return character.characterType;
  }

  const { command, combat, intelligence, politics, charisma } = character;
  const militarySum = command + combat;
  const intellectSum = intelligence + politics + charisma;

  if (militarySum > intellectSum * 1.15) {
    return 'military';
  } else if (intellectSum > militarySum * 1.15) {
    return 'strategist';
  } else {
    return 'balanced';
  }
}

/**
 * 验证角色属性是否符合规则
 */
function validateCharacterAttributes(character) {
  const {
    name,
    rarity,
    stage,
    luck,
    courage,
    command,
    combat,
    intelligence,
    politics,
    charisma,
  } = character;

  // 推断角色类型
  const characterType = inferCharacterType(character);

  // 1. 计算总属性点
  const total = luck + courage + command + combat + intelligence + politics + charisma;

  // 2. 获取期望范围
  const expectedRange = getExpectedAttributeRange(rarity, stage, characterType);

  const issues = [];
  const warnings = [];

  // 3. 验证总属性点
  if (total < expectedRange.min - 0.01 || total > expectedRange.max + 0.01) {
    issues.push(
      `总属性点 ${total.toFixed(1)} 不在期望范围 ${expectedRange.min.toFixed(1)}-${expectedRange.max.toFixed(1)} 内`
    );
  }

  // 注意：对于已存在的角色，不验证武力组/智力组比例
  // 比例规则只用于创建新武将时参考
  
  // 4. 验证类型分配（已禁用）
  const militarySum = command + combat;
  const intellectSum = intelligence + politics + charisma;

  // 以下验证已禁用，仅保留用于显示信息
  /*
  if (characterType === 'military') {
    const ratio = militarySum / intellectSum;

    if (ratio < 1.2) {
      issues.push(
        `武官型属性比例 ${ratio.toFixed(2)} 过低（应 ≥ 1.2），武力组(${militarySum.toFixed(1)}) vs 智力组(${intellectSum.toFixed(1)})`
      );
    } else if (ratio > 1.5) {
      warnings.push(
        `武官型属性比例 ${ratio.toFixed(2)} 过高（建议 ≤ 1.5），武力组(${militarySum.toFixed(1)}) vs 智力组(${intellectSum.toFixed(1)})`
      );
    }
  } else if (characterType === 'strategist') {
    const ratio = intellectSum / militarySum;

    if (ratio < 1.2) {
      issues.push(
        `军师型属性比例 ${ratio.toFixed(2)} 过低（应 ≥ 1.2），智力组(${intellectSum.toFixed(1)}) vs 武力组(${militarySum.toFixed(1)})`
      );
    } else if (ratio > 1.5) {
      warnings.push(
        `军师型属性比例 ${ratio.toFixed(2)} 过高（建议 ≤ 1.5），智力组(${intellectSum.toFixed(1)}) vs 武力组(${militarySum.toFixed(1)})`
      );
    }
  }
  */

  // 5. 验证单个属性范围
  const attributeRanges = {
    luck: [0, 10],
    courage: [0, 10],
    command: [0, 10],
    combat: [0, 10],
    intelligence: [0, 10],
    politics: [0, 10],
    charisma: [0, 10],
  };

  for (const [attr, [min, max]] of Object.entries(attributeRanges)) {
    const value = character[attr];
    if (value < min || value > max) {
      issues.push(`${attr} 属性值 ${value} 超出范围 ${min}-${max}`);
    }
  }

  return {
    name,
    characterType,
    total: total.toFixed(1),
    expectedRange: `${expectedRange.min.toFixed(1)}-${expectedRange.max.toFixed(1)}`,
    militarySum: militarySum.toFixed(1),
    intellectSum: intellectSum.toFixed(1),
    ratio:
      characterType === 'military'
        ? (militarySum / intellectSum).toFixed(2)
        : characterType === 'strategist'
        ? (intellectSum / militarySum).toFixed(2)
        : 'N/A',
    valid: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * 生成调整建议
 */
function generateAdjustmentSuggestion(character, validation) {
  if (validation.valid && validation.warnings.length === 0) {
    return null;
  }

  const suggestions = [];

  // 如果总属性点不符合
  if (validation.issues.some(issue => issue.includes('总属性点'))) {
    const currentTotal = parseFloat(validation.total);
    const [min, max] = validation.expectedRange.split('-').map(parseFloat);
    const targetTotal = (min + max) / 2;
    const diff = targetTotal - currentTotal;

    suggestions.push(`建议调整总属性点：当前 ${currentTotal.toFixed(1)}，目标 ${targetTotal.toFixed(1)}，差值 ${diff > 0 ? '+' : ''}${diff.toFixed(1)}`);
  }

  // 如果类型分配不符合
  if (validation.characterType === 'military' && validation.issues.some(issue => issue.includes('武官型'))) {
    suggestions.push('建议：提升 command/combat 属性，或降低 intelligence/politics/charisma 属性');
  } else if (validation.characterType === 'strategist' && validation.issues.some(issue => issue.includes('军师型'))) {
    suggestions.push('建议：提升 intelligence/politics/charisma 属性，或降低 command/combat 属性');
  }

  return suggestions;
}

/**
 * 主函数
 */
function main() {
  console.log('='.repeat(80));
  console.log('角色属性验证报告');
  console.log('='.repeat(80));
  console.log('');

  const results = charactersData.characters.map(char => validateCharacterAttributes(char));

  // 统计
  const validCount = results.filter(r => r.valid && r.warnings.length === 0).length;
  const warningCount = results.filter(r => r.valid && r.warnings.length > 0).length;
  const errorCount = results.filter(r => !r.valid).length;

  console.log(`总计：${results.length} 个角色`);
  console.log(`✅ 完全符合：${validCount} 个`);
  console.log(`⚠️  有警告：${warningCount} 个`);
  console.log(`❌ 有错误：${errorCount} 个`);
  console.log('');

  // 详细报告
  results.forEach((result, index) => {
    const char = charactersData.characters[index];

    if (!result.valid || result.warnings.length > 0) {
      console.log('-'.repeat(80));
      console.log(`${result.valid ? '⚠️ ' : '❌'} ${result.name} (${char.rarity}, ${char.stage}, ${result.characterType})`);
      console.log(`   总属性点：${result.total} (期望：${result.expectedRange})`);
      console.log(`   武力组：${result.militarySum} | 智力组：${result.intellectSum} | 比例：${result.ratio}`);

      if (result.issues.length > 0) {
        console.log('   问题：');
        result.issues.forEach(issue => console.log(`     - ${issue}`));
      }

      if (result.warnings.length > 0) {
        console.log('   警告：');
        result.warnings.forEach(warning => console.log(`     - ${warning}`));
      }

      const suggestions = generateAdjustmentSuggestion(char, result);
      if (suggestions && suggestions.length > 0) {
        console.log('   建议：');
        suggestions.forEach(suggestion => console.log(`     - ${suggestion}`));
      }

      console.log('');
    }
  });

  // 完全符合的角色
  console.log('-'.repeat(80));
  console.log('✅ 完全符合规则的角色：');
  console.log('');
  results.forEach((result, index) => {
    if (result.valid && result.warnings.length === 0) {
      const char = charactersData.characters[index];
      console.log(`   ${result.name} (${char.rarity}, ${char.stage}, ${result.characterType}) - 总计：${result.total}`);
    }
  });

  console.log('');
  console.log('='.repeat(80));
  console.log('验证完成');
  console.log('='.repeat(80));
}

// 运行
main();
