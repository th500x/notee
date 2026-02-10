#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, '../public/data/shared/skills.json');

console.log('📊 检查技能名称重复...\n');

const skills = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));

const nameMap = new Map();
const duplicates = [];

for (const skill of skills) {
  const name = skill.name;
  
  if (nameMap.has(name)) {
    duplicates.push({
      name,
      ids: [nameMap.get(name), skill.id]
    });
  } else {
    nameMap.set(name, skill.id);
  }
}

if (duplicates.length > 0) {
  console.log('⚠️  发现重复的技能名：\n');
  duplicates.forEach(d => {
    console.log(`  "${d.name}"`);
    d.ids.forEach(id => {
      const skill = skills.find(s => s.id === id);
      console.log(`    - ${id} (${skill.rarityName}${skill.typeName})`);
    });
    console.log();
  });
} else {
  console.log('✅ 没有发现重复的技能名！');
}

console.log(`\n总计: ${skills.length} 个技能`);
