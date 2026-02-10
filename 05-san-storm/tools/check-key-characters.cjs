const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/shared/characters.json'), 'utf8'));

const keyCharacters = ['刘备', '关羽', '张飞', '曹操', '袁绍', '张角', '袁术', '吕布', '赵云', '诸葛亮'];

console.log('关键角色验证：\n');

keyCharacters.forEach(name => {
  const c = data.characters.find(ch => ch.name === name);
  if (c) {
    const total = c.luck + c.courage + c.command + c.combat + c.intelligence + c.politics + c.charisma;
    console.log(`✅ ${c.name.padEnd(6)} (${c.rarity.padEnd(9)}, ${c.stage.padEnd(4)}): ID=${c.id}, Total=${total.toFixed(1)}`);
  } else {
    console.log(`❌ ${name} - 未找到`);
  }
});

console.log(`\n总计: ${data.characters.length} 个角色`);
console.log(`所有角色都有ID: ${data.characters.every(c => c.id) ? '✅' : '❌'}`);
