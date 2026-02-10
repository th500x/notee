const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/shared/characters.json'), 'utf8'));

console.log('检查 stage 字段值：\n');

// 统计 stage 值
const stageCount = {};
data.characters.forEach(c => {
  stageCount[c.stage] = (stageCount[c.stage] || 0) + 1;
});

console.log('Stage 值统计：');
Object.entries(stageCount).forEach(([stage, count]) => {
  console.log(`  ${stage}: ${count} 个`);
});

console.log('\n示例角色：');
const samples = ['刘备', '曹操', '董卓', '皇甫嵩', '关羽', '张飞'];
samples.forEach(name => {
  const c = data.characters.find(ch => ch.name === name);
  if (c) {
    console.log(`  ${c.name.padEnd(6)}: stage='${c.stage}' (${c.rarity}, age=${c.age})`);
  }
});

// 检查是否有中文 stage
const hasChinese = data.characters.some(c => 
  c.stage === '茅庐' || c.stage === '巅峰' || c.stage === '不惑'
);

console.log(`\n✅ 所有 stage 都是英文: ${!hasChinese ? '是' : '否'}`);
