#!/usr/bin/env node

/**
 * 为武将自动分配技能
 * 
 * 规则：
 * 1. 技能稀有度必须与武将稀有度匹配
 * 2. skill_1 分配主动技能
 * 3. skill_2 分配被动技能
 * 4. 随机分配，避免重复
 */

const fs = require('fs');
const path = require('path');

const HERO_CSV_PATH = path.join(__dirname, 'hero-template.csv');
const SKILLS_JSON_PATH = path.join(__dirname, '../public/data/shared/skills.json');

console.log('🎮 为武将分配技能...\n');

// 读取技能数据
const skills = JSON.parse(fs.readFileSync(SKILLS_JSON_PATH, 'utf-8'));

// 按稀有度和类型分组
const skillsByRarity = {
  core: { active: [], passive: [] },
  legendary: { active: [], passive: [] },
  epic: { active: [], passive: [] },
  rare: { active: [], passive: [] },
  common: { active: [], passive: [] }
};

skills.forEach(skill => {
  const type = skill.type === 'active' ? 'active' : 'passive';
  skillsByRarity[skill.rarity][type].push(skill);
});

console.log('📊 技能统计：');
Object.entries(skillsByRarity).forEach(([rarity, types]) => {
  console.log(`  ${rarity}: 主动${types.active.length}个, 被动${types.passive.length}个`);
});
console.log();

// 读取武将CSV
let content = fs.readFileSync(HERO_CSV_PATH, 'utf-8');

// 去除BOM（如果存在）
if (content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
}

const lines = content.split(/\r?\n/); // 兼容不同的换行符
const header = lines[0];

console.log('📖 读取武将数据...');
console.log(`   总行数: ${lines.length}`);
console.log(`   表头: ${header.substring(0, 50)}...`);

// 解析CSV
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  fields.push(current);
  return fields;
}

const headers = parseCSVLine(header);
const heroData = [];

console.log(`   字段数: ${headers.length}`);

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const fields = parseCSVLine(line);
  
  const hero = {};
  headers.forEach((h, idx) => {
    hero[h] = (fields[idx] || '').trim(); // trim所有字段
  });
  
  // 只处理S1赛季的武将，且有有效的ID和稀有度
  if (hero.id && hero.id.startsWith('char_') && hero.rarity && hero.season === 'S1') {
    heroData.push(hero);
  }
}

console.log(`✅ 读取完成，共 ${heroData.length} 个武将\n`);

// 如果没有读取到武将，停止执行
if (heroData.length === 0) {
  console.error('❌ 错误：没有读取到任何武将数据！');
  console.error('   文件可能为空或格式不正确');
  console.error('   为了安全，停止执行，不会修改文件');
  process.exit(1);
}

// 随机选择技能（避免重复）
const usedSkills = {
  core: { active: new Set(), passive: new Set() },
  legendary: { active: new Set(), passive: new Set() },
  epic: { active: new Set(), passive: new Set() },
  rare: { active: new Set(), passive: new Set() },
  common: { active: new Set(), passive: new Set() }
};

function getRandomSkill(rarity, type) {
  const availableSkills = skillsByRarity[rarity][type].filter(
    skill => !usedSkills[rarity][type].has(skill.id)
  );
  
  if (availableSkills.length === 0) {
    // 如果没有可用技能了，重置使用记录
    usedSkills[rarity][type].clear();
    return skillsByRarity[rarity][type][
      Math.floor(Math.random() * skillsByRarity[rarity][type].length)
    ];
  }
  
  const skill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
  usedSkills[rarity][type].add(skill.id);
  return skill;
}

// 为每个武将分配技能
console.log('🎲 分配技能...\n');

const stats = {
  total: 0,
  byRarity: { core: 0, legendary: 0, epic: 0, rare: 0, common: 0 }
};

heroData.forEach(hero => {
  const rarity = hero.rarity;
  
  if (!skillsByRarity[rarity]) {
    console.warn(`⚠️  ${hero.name} 的稀有度 ${rarity} 无效，跳过`);
    return;
  }
  
  // 分配主动技能
  const activeSkill = getRandomSkill(rarity, 'active');
  hero.skill_1 = activeSkill.id;
  
  // 分配被动技能
  const passiveSkill = getRandomSkill(rarity, 'passive');
  hero.skill_2 = passiveSkill.id;
  
  stats.total++;
  stats.byRarity[rarity]++;
  
  console.log(`✅ ${hero.name} (${rarity})`);
  console.log(`   主动: ${activeSkill.name} (${activeSkill.id})`);
  console.log(`   被动: ${passiveSkill.name} (${passiveSkill.id})`);
});

console.log('\n📊 分配统计：');
console.log(`   总计: ${stats.total} 个武将`);
Object.entries(stats.byRarity).forEach(([rarity, count]) => {
  if (count > 0) {
    console.log(`   ${rarity}: ${count} 个`);
  }
});

// 写回CSV
console.log('\n💾 写入CSV文件...');

const newLines = [header];

heroData.forEach(hero => {
  const fields = headers.map(h => {
    const value = hero[h] || '';
    // 如果包含逗号或引号，需要用引号包裹
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  });
  newLines.push(fields.join(','));
});

fs.writeFileSync(HERO_CSV_PATH, newLines.join('\n'), 'utf-8');

console.log(`✅ 写入完成: ${HERO_CSV_PATH}\n`);
console.log('🎉 技能分配完成！');
