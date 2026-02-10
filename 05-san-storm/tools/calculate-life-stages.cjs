/**
 * 计算武将人生阶段数据
 * 
 * 功能：
 * 1. 读取 characters.json
 * 2. 根据S1年龄计算出生年份
 * 3. 计算9个赛季中每个武将的年龄和阶段
 * 4. 计算各阶段的属性值
 * 5. 生成完整的人生阶段数据
 */

const fs = require('fs');
const path = require('path');

// 9个赛季的年份定义
const SEASONS = [
  { id: 'S1', name: '黄巾之乱', year: 184 },
  { id: 'S2', name: '董卓之乱', year: 189 },
  { id: 'S3', name: '群雄割据', year: 194 },
  { id: 'S4', name: '官渡之战', year: 200 },
  { id: 'S5', name: '赤壁之战', year: 208 },
  { id: 'S6', name: '三国鼎立', year: 220 },
  { id: 'S7', name: '诸葛北伐', year: 228 },
  { id: 'S8', name: '司马崛起', year: 249 },
  { id: 'S9', name: '三国归晋', year: 280 },
];

// 阶段修正表
const STAGE_MODIFIERS = {
  early: { modifier: 0.95, name: '茅庐', icon: '🌱', description: '初出茅庐，潜力大但经验不足' },
  peak: { modifier: 1.0, name: '巅峰', icon: '⭐', description: '人生巅峰，数值最高' },
  late: { modifier: 0.90, name: '不惑', icon: '🧙', description: '不惑之年，体力下降但智慧增长' },
  death: { modifier: 0.80, name: '卒', icon: '💀', description: '角色已故，实力大幅下降' },
};

// 根据年龄判断阶段
function getStageByAge(age, isDead = false) {
  if (age < 0) return null; // 未出生
  if (isDead) return 'death'; // 已故
  if (age < 25) return 'early';
  if (age <= 45) return 'peak';
  return 'late';
}

// 计算属性值（应用阶段修正）
function calculateAttributes(character, modifier) {
  const attributes = {
    luck: character.luck,
    courage: character.courage,
    command: character.command,
    combat: character.combat,
    intelligence: character.intelligence,
    politics: character.politics,
    charisma: character.charisma,
  };

  const modifiedAttributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    modifiedAttributes[key] = Math.round(value * modifier * 10) / 10;
  }

  return modifiedAttributes;
}

// 计算总属性点
function calculateTotalAttributes(attributes) {
  return Object.values(attributes).reduce((sum, val) => sum + val, 0);
}

// 主函数
function calculateLifeStages() {
  console.log('🔄 开始计算武将人生阶段数据...\n');

  // 读取武将数据
  const charactersPath = path.join(__dirname, '../public/data/shared/characters.json');
  const charactersData = JSON.parse(fs.readFileSync(charactersPath, 'utf-8'));
  const characters = charactersData.characters;

  console.log(`📊 共读取 ${characters.length} 个武将\n`);

  // S1赛季年份
  const S1_YEAR = 184;

  // 存储所有武将的人生阶段数据
  const lifeStagesData = {};

  // 遍历每个武将
  characters.forEach((character, index) => {
    const { id, name, age: s1Age, stage: s1Stage, deathYear } = character;

    // 计算出生年份
    const birthYear = S1_YEAR - s1Age;

    console.log(`[${index + 1}/${characters.length}] ${name} (${id})`);
    console.log(`  S1年龄: ${s1Age}岁, S1阶段: ${s1Stage}, 出生年份: ${birthYear}年${deathYear ? `, 卒于: ${deathYear}年` : ''}`);

    // 计算9个赛季的数据
    const seasonsData = SEASONS.map(season => {
      const age = season.year - birthYear;
      
      // 判断是否已故（赛季开始年份 > 去世年份，才算已故）
      // 因为去世那一年赛季开始时还活着，只是在那一年的某一天去世
      const isDead = deathYear && season.year > deathYear;
      const stage = getStageByAge(age, isDead);

      if (!stage) {
        return {
          season: season.id,
          seasonName: season.name,
          year: season.year,
          age: age,
          stage: null,
          stageName: '未出生',
          stageIcon: '❓',
          modifier: 0,
          attributes: null,
          total: 0,
        };
      }

      const stageInfo = STAGE_MODIFIERS[stage];
      const attributes = calculateAttributes(character, stageInfo.modifier);
      const total = calculateTotalAttributes(attributes);

      return {
        season: season.id,
        seasonName: season.name,
        year: season.year,
        age: age,
        stage: stage,
        stageName: stageInfo.name,
        stageIcon: stageInfo.icon,
        stageDescription: stageInfo.description,
        modifier: stageInfo.modifier,
        attributes: attributes,
        total: Math.round(total * 10) / 10,
        isDead: isDead || false,
        deathYear: deathYear || null,
      };
    });

    // 存储该武将的数据
    lifeStagesData[id] = {
      id: id,
      name: name,
      birthYear: birthYear,
      deathYear: deathYear || null,
      baseAttributes: {
        luck: character.luck,
        courage: character.courage,
        command: character.command,
        combat: character.combat,
        intelligence: character.intelligence,
        politics: character.politics,
        charisma: character.charisma,
      },
      seasons: seasonsData,
    };

    // 显示部分赛季数据
    console.log(`  赛季数据:`);
    seasonsData.slice(0, 3).forEach(s => {
      if (s.stage) {
        const deadMark = s.isDead ? ' 💀已故' : '';
        console.log(`    ${s.season} (${s.year}年): ${s.age}岁, ${s.stageIcon}${s.stageName}, 总属性${s.total}${deadMark}`);
      } else {
        console.log(`    ${s.season} (${s.year}年): ${s.stageName}`);
      }
    });
    console.log('');
  });

  // 保存数据
  const outputPath = path.join(__dirname, '../public/data/shared/life-stages.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ lifeStages: lifeStagesData }, null, 2),
    'utf-8'
  );

  console.log('✅ 人生阶段数据计算完成！');
  console.log(`📁 输出文件: ${outputPath}`);
  console.log(`📊 共计算 ${Object.keys(lifeStagesData).length} 个武将的数据\n`);

  // 生成统计报告
  generateStatistics(lifeStagesData);
}

// 生成统计报告
function generateStatistics(lifeStagesData) {
  console.log('📊 统计报告\n');

  // 统计每个赛季的阶段分布
  SEASONS.forEach(season => {
    const stageCount = {
      early: 0,
      peak: 0,
      late: 0,
      death: 0,
      unborn: 0,
    };

    Object.values(lifeStagesData).forEach(character => {
      const seasonData = character.seasons.find(s => s.season === season.id);
      if (!seasonData.stage) {
        stageCount.unborn++;
      } else {
        stageCount[seasonData.stage]++;
      }
    });

    console.log(`${season.id} - ${season.name} (${season.year}年):`);
    console.log(`  🌱 茅庐: ${stageCount.early}人`);
    console.log(`  ⭐ 巅峰: ${stageCount.peak}人`);
    console.log(`  🧙 不惑: ${stageCount.late}人`);
    console.log(`  💀 卒: ${stageCount.death}人`);
    if (stageCount.unborn > 0) {
      console.log(`  ❓ 未出生: ${stageCount.unborn}人`);
    }
    console.log('');
  });
}

// 执行
try {
  calculateLifeStages();
} catch (error) {
  console.error('❌ 错误:', error.message);
  process.exit(1);
}
