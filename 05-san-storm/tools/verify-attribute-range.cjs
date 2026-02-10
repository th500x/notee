/**
 * 验证属性范围（0-10）
 */

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../public/data/shared/characters.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const chars = data.characters;

console.log('='.repeat(80));
console.log('属性范围验证（0-10）');
console.log('='.repeat(80));
console.log('');

let errors = 0;
let warnings = 0;

const attrs = ['luck', 'courage', 'command', 'combat', 'intelligence', 'politics', 'charisma'];

chars.forEach(c => {
  attrs.forEach(attr => {
    const value = c[attr];
    
    // 检查是否超过10
    if (value > 10.0) {
      console.log(`❌ ${c.name}: ${attr} = ${value} > 10.0`);
      errors++;
    }
    
    // 检查是否低于3（警告）
    if (value < 3.0) {
      console.log(`⚠️  ${c.name}: ${attr} = ${value} < 3.0`);
      warnings++;
    }
  });
});

console.log('');
console.log('-'.repeat(80));
console.log('');

if (errors === 0 && warnings === 0) {
  console.log('✅ 所有属性都在正确范围内（3.0-10.0）');
} else {
  if (errors > 0) {
    console.log(`❌ 发现 ${errors} 个错误（属性 > 10.0）`);
  }
  if (warnings > 0) {
    console.log(`⚠️  发现 ${warnings} 个警告（属性 < 3.0）`);
  }
}

console.log('');

// 统计属性分布
console.log('属性值分布统计：');
console.log('');

attrs.forEach(attr => {
  const values = chars.map(c => c[attr]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
  
  console.log(`${attr.padEnd(15)}: 最小=${min.toFixed(1)}, 最大=${max.toFixed(1)}, 平均=${avg}`);
});

console.log('');
console.log('='.repeat(80));
