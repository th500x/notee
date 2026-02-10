#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, 'skill-template.csv');

console.log('📊 检查技能数据...\n');

const content = fs.readFileSync(CSV_PATH, 'utf-8');
const lines = content.split('\n').filter(l => l.trim() && !l.startsWith(',,'));

console.log('总行数:', lines.length - 1, '个技能\n');

// 检查ID重复
const ids = new Map();
const issues = [];

for (let i = 1; i < lines.length; i++) {
  const fields = lines[i].split(',');
  const id = fields[0];
  
  if (!id || !id.startsWith('skill_')) continue;
  
  if (ids.has(id)) {
    issues.push(`重复ID: ${id} (第${ids.get(id)}行 和 第${i+1}行)`);
  } else {
    ids.set(id, i + 1);
  }
}

// 统计
const stats = {
  active: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  passive: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
};

for (const id of ids.keys()) {
  const parts = id.split('_');
  const type = parts[1];
  const rarity = parts[2][0];
  
  if (type === '1') stats.active[rarity]++;
  if (type === '2') stats.passive[rarity]++;
}

console.log('主动技能分布：');
console.log('  核心(5):', stats.active[5], '个');
console.log('  传奇(4):', stats.active[4], '个');
console.log('  史诗(3):', stats.active[3], '个');
console.log('  稀有(2):', stats.active[2], '个');
console.log('  普通(1):', stats.active[1], '个');
console.log('  小计:', Object.values(stats.active).reduce((a,b)=>a+b,0), '个\n');

console.log('被动技能分布：');
console.log('  核心(5):', stats.passive[5], '个');
console.log('  传奇(4):', stats.passive[4], '个');
console.log('  史诗(3):', stats.passive[3], '个');
console.log('  稀有(2):', stats.passive[2], '个');
console.log('  普通(1):', stats.passive[1], '个');
console.log('  小计:', Object.values(stats.passive).reduce((a,b)=>a+b,0), '个\n');

console.log('总计:', ids.size, '个技能\n');

if (issues.length > 0) {
  console.log('发现问题：');
  issues.forEach(i => console.log('  -', i));
} else {
  console.log('✅ 没有发现重复ID！');
}
