#!/usr/bin/env node

/**
 * 验证武将技能分配
 * 
 * 检查：
 * 1. 所有S1武将是否都有技能
 * 2. 技能稀有度是否与武将稀有度匹配
 * 3. 技能ID是否有效
 */

const fs = require('fs');
const path = require('path');

const HERO_CSV_PATH = path.join(__dirname, 'hero-template.csv');
const SKILLS_JSON_PATH = path.join(__dirname, '../public/data/shared/skills.json');

console.log('🔍 验证武将技能分配...\n');

// 读取技能数据
const skills = JSON.parse(fs.readFileSync(SKILLS_JSON_PATH, 'utf-8'));
const skillIds = new Set(skills.map(s => s.id));

// 读取武将CSV
let content = fs.readFileSync(HERO_CSV_PATH, 'utf-8');

// 去除BOM
if (content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
}

const lines = content.split(/\r?\n/);
const header = lines[0];

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

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const fields = parseCSVLine(line);
  const hero = {};
  headers.forEach((h, idx) => {
    hero[h] = (fields[idx] || '').trim();
  });
  
  if (hero.id && hero.id.startsWith('char_') && hero.rarity && hero.season === 'S1') {
    heroData.push(hero);
  }
}

console.log(`📊 共 ${heroData.length} 个S1武将\n`);

// 验证
const errors = [];
const warnings = [];
let successCount = 0;

// 稀有度映射
const rarityMap = {
  'core': '5',
  'legendary': '4',
  'epic': '3',
  'rare': '2',
  'common': '1'
};

heroData.forEach(hero => {
  const { id, name, rarity, skill_1, skill_2 } = hero;
  
  // 检查是否有技能
  if (!skill_1 || !skill_2) {
    errors.push(`❌ ${name} (${id}): 缺少技能 - skill_1: ${skill_1 || '无'}, skill_2: ${skill_2 || '无'}`);
    return;
  }
  
  // 检查技能ID是否存在
  if (!skillIds.has(skill_1)) {
    errors.push(`❌ ${name} (${id}): skill_1 "${skill_1}" 不存在于技能库中`);
    return;
  }
  
  if (!skillIds.has(skill_2)) {
    errors.push(`❌ ${name} (${id}): skill_2 "${skill_2}" 不存在于技能库中`);
    return;
  }
  
  // 检查稀有度匹配
  const expectedRarityCode = rarityMap[rarity];
  
  // 检查skill_1（主动技能）
  const skill1Match = skill_1.match(/^skill_1_(\d)(\d{3})$/);
  if (!skill1Match) {
    errors.push(`❌ ${name} (${id}): skill_1 "${skill_1}" 格式错误`);
    return;
  }
  
  if (skill1Match[1] !== expectedRarityCode) {
    errors.push(`❌ ${name} (${id}): skill_1稀有度不匹配 - 武将: ${rarity}, 技能: ${skill_1}`);
    return;
  }
  
  // 检查skill_2（被动技能）
  const skill2Match = skill_2.match(/^skill_2_(\d)(\d{3})$/);
  if (!skill2Match) {
    errors.push(`❌ ${name} (${id}): skill_2 "${skill_2}" 格式错误`);
    return;
  }
  
  if (skill2Match[1] !== expectedRarityCode) {
    errors.push(`❌ ${name} (${id}): skill_2稀有度不匹配 - 武将: ${rarity}, 技能: ${skill_2}`);
    return;
  }
  
  successCount++;
});

// 输出结果
console.log('📋 验证结果：\n');

if (errors.length > 0) {
  console.log('❌ 发现错误：\n');
  errors.forEach(err => console.log(err));
  console.log();
}

if (warnings.length > 0) {
  console.log('⚠️  警告：\n');
  warnings.forEach(warn => console.log(warn));
  console.log();
}

console.log(`✅ 成功: ${successCount} 个武将`);
console.log(`❌ 错误: ${errors.length} 个武将`);
console.log(`⚠️  警告: ${warnings.length} 个武将`);

if (errors.length === 0 && warnings.length === 0) {
  console.log('\n🎉 所有武将技能分配正确！');
  process.exit(0);
} else {
  console.log('\n⚠️  存在问题，请检查');
  process.exit(1);
}
