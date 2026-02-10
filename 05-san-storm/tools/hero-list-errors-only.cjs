/**
 * 列出所有有错误的角色（简化版）
 */

const fs = require('fs');
const path = require('path');

const charactersPath = path.join(__dirname, '../public/data/shared/characters.json');
const charactersData = JSON.parse(fs.readFileSync(charactersPath, 'utf8'));

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

function inferCharacterType(character) {
  if (character.characterType) return character.characterType;
  const { command, combat, intelligence, politics, charisma } = character;
  const militarySum = command + combat;
  const intellectSum = intelligence + politics + charisma;
  if (militarySum > intellectSum * 1.15) return 'military';
  else if (intellectSum > militarySum * 1.15) return 'strategist';
  else return 'balanced';
}

function validateCharacter(character) {
  const { name, rarity, stage, luck, courage, command, combat, intelligence, politics, charisma } = character;
  const characterType = inferCharacterType(character);
  
  const total = luck + courage + command + combat + intelligence + politics + charisma;
  const expectedRange = getExpectedAttributeRange(rarity, stage, characterType);
  
  const issues = [];
  
  // 只验证总属性点（对于已存在的角色，不验证比例）
  // 使用 <= 和 >= 来包含边界值
  if (total < expectedRange.min - 0.01 || total > expectedRange.max + 0.01) {
    issues.push(`总属性点 ${total.toFixed(1)} 不在范围 [${expectedRange.min.toFixed(1)}, ${expectedRange.max.toFixed(1)}]`);
  }
  
  return {
    name,
    rarity,
    stage,
    characterType,
    total: total.toFixed(1),
    expectedRange: `[${expectedRange.min.toFixed(1)}, ${expectedRange.max.toFixed(1)}]`,
    valid: issues.length === 0,
    issues
  };
}

// 主函数
const results = charactersData.characters.map(char => validateCharacter(char));
const errors = results.filter(r => !r.valid);

console.log(`\n========================================`);
console.log(`总计: ${results.length} 个角色`);
console.log(`有错误: ${errors.length} 个`);
console.log(`========================================\n`);

errors.forEach((char, index) => {
  console.log(`${index + 1}. ${char.name} (${char.rarity}, ${char.stage}, ${char.characterType})`);
  console.log(`   总属性点: ${char.total} (期望: ${char.expectedRange})`);
  char.issues.forEach(issue => {
    console.log(`   - ${issue}`);
  });
  console.log('');
});

// 保存到文件
const output = errors.map((char, index) => {
  return `${index + 1}. ${char.name} (${char.rarity}, ${char.stage}, ${char.characterType})\n` +
         `   总属性点: ${char.total} (期望: ${char.expectedRange})\n` +
         char.issues.map(issue => `   - ${issue}`).join('\n') + '\n';
}).join('\n');

fs.writeFileSync(path.join(__dirname, '../validation-errors.txt'), output, 'utf8');
console.log('错误列表已保存到: validation-errors.txt');
