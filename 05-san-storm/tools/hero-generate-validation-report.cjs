/**
 * 生成角色属性验证报告（JSON格式）
 * 用于清晰地查看哪些角色不符合规则
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
  const baseRanges = {
    core: { military: [50, 60], strategist: [50, 60], balanced: [52, 62] },
    legendary: { military: [56, 60], strategist: [56, 60], balanced: [58, 62] },
    epic: { military: [52, 56], strategist: [52, 56], balanced: [54, 58] },
    rare: { military: [48, 52], strategist: [48, 52], balanced: [50, 54] },
    common: { military: [44, 48], strategist: [44, 48], balanced: [46, 50] },
  };

  const stageModifiers = {
    'peak': 1.0,
    'early': 0.95,
    'late': 0.90,
    // 兼容中文（以防万一）
    '巅峰': 1.0,
    '茅庐': 0.95,
    '不惑': 0.90,
  };

  const [min, max] = baseRanges[rarity]?.[characterType] || [0, 100];
  const modifier = stageModifiers[stage] || 1.0;

  return { min: min * modifier, max: max * modifier };
}

/**
 * 推断角色类型
 */
function inferCharacterType(character) {
  if (character.characterType) return character.characterType;

  const { command, combat, intelligence, politics, charisma } = character;
  const militarySum = command + combat;
  const intellectSum = intelligence + politics + charisma;

  if (militarySum > intellectSum * 1.15) return 'military';
  else if (intellectSum > militarySum * 1.15) return 'strategist';
  else return 'balanced';
}

/**
 * 验证角色属性
 */
function validateCharacter(character) {
  const { name, rarity, stage, luck, courage, command, combat, intelligence, politics, charisma } = character;
  const characterType = inferCharacterType(character);
  
  const total = luck + courage + command + combat + intelligence + politics + charisma;
  const expectedRange = getExpectedAttributeRange(rarity, stage, characterType);
  
  const militarySum = command + combat;
  const intellectSum = intelligence + politics + charisma;
  
  const issues = [];
  const warnings = [];
  
  // 验证总属性点
  if (total < expectedRange.min - 0.01 || total > expectedRange.max + 0.01) {
    issues.push({
      type: 'total_out_of_range',
      message: `总属性点 ${total.toFixed(1)} 不在期望范围 ${expectedRange.min.toFixed(1)}-${expectedRange.max.toFixed(1)} 内`,
      current: total,
      expected: { min: expectedRange.min, max: expectedRange.max }
    });
  }
  
  // 注意：对于已存在的角色，不验证武力组/智力组比例
  // 比例规则只用于创建新武将时参考
  
  return {
    name,
    rarity,
    stage,
    characterType,
    total: parseFloat(total.toFixed(1)),
    expectedRange: { min: parseFloat(expectedRange.min.toFixed(1)), max: parseFloat(expectedRange.max.toFixed(1)) },
    militarySum: parseFloat(militarySum.toFixed(1)),
    intellectSum: parseFloat(intellectSum.toFixed(1)),
    ratio: characterType === 'balanced' ? null : parseFloat((characterType === 'military' ? militarySum / intellectSum : intellectSum / militarySum).toFixed(2)),
    valid: issues.length === 0,
    hasWarnings: warnings.length > 0,
    issues,
    warnings,
    attributes: { luck, courage, command, combat, intelligence, politics, charisma }
  };
}

/**
 * 主函数
 */
function main() {
  const results = charactersData.characters.map(char => validateCharacter(char));
  
  // 统计
  const stats = {
    total: results.length,
    valid: results.filter(r => r.valid && !r.hasWarnings).length,
    withWarnings: results.filter(r => r.valid && r.hasWarnings).length,
    withErrors: results.filter(r => !r.valid).length
  };
  
  // 分类
  const categorized = {
    perfect: results.filter(r => r.valid && !r.hasWarnings),
    warnings: results.filter(r => r.valid && r.hasWarnings),
    errors: results.filter(r => !r.valid)
  };
  
  // 按问题类型分组
  const errorsByType = {
    total_out_of_range: [],
    military_ratio_too_low: [],
    strategist_ratio_too_low: [],
  };
  
  categorized.errors.forEach(char => {
    char.issues.forEach(issue => {
      if (errorsByType[issue.type]) {
        errorsByType[issue.type].push({
          name: char.name,
          rarity: char.rarity,
          stage: char.stage,
          characterType: char.characterType,
          ...issue
        });
      }
    });
  });
  
  const report = {
    generatedAt: new Date().toISOString(),
    stats,
    categorized,
    errorsByType
  };
  
  // 保存报告
  const reportPath = path.join(__dirname, '../validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  
  console.log('Validation report generated successfully!');
  console.log(`Total: ${stats.total}`);
  console.log(`Perfect: ${stats.valid}`);
  console.log(`Warnings: ${stats.withWarnings}`);
  console.log(`Errors: ${stats.withErrors}`);
  console.log(`\nReport saved to: ${reportPath}`);
}

main();
