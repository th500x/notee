/**
 * 验证生成的角色数据
 */

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../public/data/shared/characters.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const chars = data.characters;

console.log('='.repeat(80));
console.log('角色数据验证');
console.log('='.repeat(80));
console.log('');

console.log(`总角色数: ${chars.length}`);
console.log('');

// 生涯分布
console.log('生涯分布:');
const stages = {};
chars.forEach(c => stages[c.stage] = (stages[c.stage] || 0) + 1);
const stageNames = {
  early: '🌱 茅庐',
  peak: '⭐ 巅峰',
  late: '🧙 不惑',
  death: '💀 卒',
};
Object.entries(stages).forEach(([stage, count]) => {
  console.log(`  ${stageNames[stage]}: ${count}个`);
});
console.log('');

// 示例角色
console.log('示例角色:');
chars.slice(0, 5).forEach(c => {
  const total = (c.luck + c.courage + c.command + c.combat + c.intelligence + c.politics + c.charisma).toFixed(1);
  console.log(`  ${c.name} (${c.rarity}, ${c.characterType})`);
  console.log(`    生涯: ${stageNames[c.stage]} (${c.age}岁)`);
  console.log(`    属性: 总计${total}`);
  console.log(`    技能: ${c.skill_1}, ${c.skill_2}`);
  console.log('');
});

// 验证属性范围
console.log('属性验证:');
let errors = 0;
chars.forEach(c => {
  // 检查属性是否 > 3.0
  const attrs = ['luck', 'courage', 'command', 'combat', 'intelligence', 'politics', 'charisma'];
  attrs.forEach(attr => {
    if (c[attr] < 3.0) {
      console.log(`  ❌ ${c.name}: ${attr} = ${c[attr]} < 3.0`);
      errors++;
    }
  });
  
  // 检查技能稀有度匹配
  const rarityMap = { core: '5', legendary: '4', epic: '3', rare: '2', common: '1' };
  const expectedCode = rarityMap[c.rarity];
  if (c.skill_1 && !c.skill_1.includes(`_${expectedCode}`)) {
    console.log(`  ❌ ${c.name}: skill_1稀有度不匹配 (${c.rarity} vs ${c.skill_1})`);
    errors++;
  }
  if (c.skill_2 && !c.skill_2.includes(`_${expectedCode}`)) {
    console.log(`  ❌ ${c.name}: skill_2稀有度不匹配 (${c.rarity} vs ${c.skill_2})`);
    errors++;
  }
});

if (errors === 0) {
  console.log('  ✅ 所有属性和技能都符合规则');
} else {
  console.log(`  ❌ 发现 ${errors} 个错误`);
}
console.log('');

console.log('='.repeat(80));
