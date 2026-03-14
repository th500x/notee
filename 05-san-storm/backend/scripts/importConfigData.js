/**
 * 配置数据导入脚本
 * 
 * @description 从JSON文件导入势力和部队配置数据到MySQL数据库
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const { pool } = require('../database/connection');

// JSON文件路径
const FACTIONS_JSON = path.join(__dirname, '../../wiki/dist/data/shared/factions.json');
const TROOPS_JSON = path.join(__dirname, '../../wiki/dist/data/shared/troops.json');
const SKILLS_JSON = path.join(__dirname, '../../wiki/public/data/shared/skills.json');

/**
 * 导入势力配置
 */
async function importFactions() {
  console.log('📊 开始导入势力配置...');
  
  try {
    // 读取JSON文件（处理BOM）
    let fileContent = fs.readFileSync(FACTIONS_JSON, 'utf8');
    // 移除BOM
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }
    const factionsData = JSON.parse(fileContent);
    const factions = factionsData.factions;
    
    console.log(`   找到 ${factions.length} 个势力`);
    
    // 清空现有数据
    await pool.query('DELETE FROM config_factions WHERE season = ?', ['san_1']);
    console.log('   ✓ 清空现有数据');
    
    // 插入数据
    let successCount = 0;
    for (const faction of factions) {
      try {
        await pool.query(`
          INSERT INTO config_factions (
            faction_id, season, faction_name, faction_leader,
            icon, color, style, max_players,
            faction_bonuses, description, difficulty,
            version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
          faction.id,
          'san_1', // 从ID中提取
          faction.name,
          faction.leader,
          faction.icon,
          faction.color,
          faction.style,
          faction.max_players,
          JSON.stringify(faction.bonuses),
          faction.description,
          faction.difficulty,
          '1.0.0'
        ]);
        
        successCount++;
        console.log(`   ✓ ${faction.name} (${faction.id})`);
      } catch (error) {
        console.error(`   ✗ ${faction.name} 导入失败:`, error.message);
      }
    }
    
    console.log(`✅ 势力配置导入完成: ${successCount}/${factions.length}`);
    return successCount;
    
  } catch (error) {
    console.error('❌ 势力配置导入失败:', error);
    throw error;
  }
}

/**
 * 导入部队配置
 */
async function importTroops() {
  console.log('\n📊 开始导入部队配置...');
  
  try {
    // 读取JSON文件（处理BOM）
    let fileContent = fs.readFileSync(TROOPS_JSON, 'utf8');
    // 移除BOM
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }
    const troopsData = JSON.parse(fileContent);
    const troops = troopsData.troops;
    
    console.log(`   找到 ${troops.length} 个部队`);
    
    // 清空现有数据
    await pool.query('DELETE FROM config_troops WHERE season = ?', ['san_1']);
    console.log('   ✓ 清空现有数据');
    
    // 插入数据
    let successCount = 0;
    for (const troop of troops) {
      try {
        // 转换数值（×10）
        const attack = Math.round(troop.attack * 10);
        const defense = Math.round(troop.defense * 10);
        
        // 构建特殊能力JSON
        const specialAbility = {
          skills: troop.skills || [],
          counters: {
            infantry: troop.infantryCounter || 1,
            cavalry: troop.cavalryCounter || 1,
            archer: troop.archerCounter || 1,
            siege: troop.siegeCounter || 1
          },
          adaptation: {
            plain: troop.plainAdapt || 1,
            hill: troop.hillAdapt || 1,
            forest: troop.forestAdapt || 1,
            siege: troop.siegeAdapt || 1
          },
          effects: {
            attack: troop.attackEffect || '',
            projectile: troop.projectileSprite || '',
            hit: troop.hitEffect || ''
          }
        };
        
        await pool.query(`
          INSERT INTO config_troops (
            troop_id, season, troop_name, rarity, troop_type,
            attack, defense, max_troops, speed, movement, attack_range,
            special_ability, description, version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
          troop.id,
          'san_1', // 从ID中提取
          troop.name,
          troop.rarity,
          troop.troopType,
          attack,
          defense,
          troop.maxTroops,
          troop.speed,
          troop.movement,
          troop.range,
          JSON.stringify(specialAbility),
          troop.description || '', // 添加description字段
          '1.0.0'
        ]);
        
        successCount++;
        
        // 只显示rare稀有度的部队（用于初始选择）
        if (troop.rarity === 'rare') {
          console.log(`   ✓ [RARE] ${troop.name} (${troop.id})`);
        }
      } catch (error) {
        console.error(`   ✗ ${troop.name} 导入失败:`, error.message);
      }
    }
    
    console.log(`✅ 部队配置导入完成: ${successCount}/${troops.length}`);
    
    // 统计各稀有度数量
    const [stats] = await pool.query(`
      SELECT rarity, COUNT(*) as count
      FROM config_troops
      WHERE season = 'san_1'
      GROUP BY rarity
      ORDER BY FIELD(rarity, 'common', 'rare', 'epic', 'legendary', 'core')
    `);
    
    console.log('\n📈 部队稀有度统计:');
    stats.forEach(stat => {
      console.log(`   ${stat.rarity}: ${stat.count}个`);
    });
    
    return successCount;
    
  } catch (error) {
    console.error('❌ 部队配置导入失败:', error);
    throw error;
  }
}

/**
 * 导入技能配置
 */
async function importSkills() {
  console.log('📊 开始导入技能配置...');
  
  try {
    // 读取JSON文件
    let fileContent = fs.readFileSync(SKILLS_JSON, 'utf8');
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }
    const skillsData = JSON.parse(fileContent);
    const skills = skillsData.skills;
    
    console.log(`   找到 ${skills.length} 个技能`);
    
    // 清空现有数据
    await pool.query('TRUNCATE TABLE config_skills');
    console.log('   ✓ 清空现有数据');
    
    // 插入数据
    let successCount = 0;
    for (const skill of skills) {
      try {
        await pool.query(`
          INSERT INTO config_skills (
            skill_id, season, skill_name, skill_type, rarity,
            damage_type, character_type, troop_type, effect_type, effect_value,
            target_range, target_count, description, version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
          skill.id,
          'san_1',  // 强制使用san_1，不从JSON读取
          skill.name,
          skill.type,
          skill.rarity,
          skill.damageType || 'none',
          skill.characterType,
          skill.troopType,  // 新增：兵种类型
          skill.effectType,
          skill.effectValue,
          skill.targetRange,  // 新增：目标范围
          skill.targetCount,  // 新增：目标数量
          skill.description,
          '1.0'
        ]);
        
        successCount++;
        
        // 只显示稀有度为rare及以上的技能
        if (['rare', 'epic', 'legendary', 'core'].includes(skill.rarity)) {
          console.log(`   ✓ [${skill.rarityName}] ${skill.name} (${skill.id})`);
        }
        
      } catch (error) {
        console.error(`   ✗ 导入技能失败 (${skill.id}):`, error.message);
      }
    }
    
    console.log(`✅ 技能配置导入完成: ${successCount}/${skills.length}\n`);
    
    // 立即验证插入结果
    const [countResult] = await pool.query('SELECT COUNT(*) as count FROM config_skills');
    console.log(`📊 数据库中实际技能数: ${countResult[0].count}`);
    
    // 统计
    const [stats] = await pool.query(`
      SELECT 
        rarity,
        skill_type,
        COUNT(*) as count
      FROM config_skills
      GROUP BY rarity, skill_type
      ORDER BY 
        FIELD(rarity, 'core', 'legendary', 'epic', 'rare', 'common'),
        skill_type
    `);
    
    console.log('📈 技能稀有度和类型统计:');
    const rarityMap = { core: '核心', legendary: '传奇', epic: '史诗', rare: '稀有', common: '普通' };
    const typeMap = { active: '主动', passive: '被动' };
    
    stats.forEach(s => {
      console.log(`   ${rarityMap[s.rarity]}${typeMap[s.skill_type]}: ${s.count}个`);
    });
    console.log('');
    
  } catch (error) {
    console.error('❌ 导入技能配置失败:', error);
    throw error;
  }
}

/**
 * 验证导入结果
 */
async function verifyImport() {
  console.log('\n🔍 验证导入结果...');
  
  try {
    // 验证势力
    const [factions] = await pool.query(`
      SELECT faction_id, faction_name, max_players, difficulty
      FROM config_factions
      WHERE season = 'san_1'
      ORDER BY faction_id
    `);
    
    console.log(`\n✅ 势力配置 (${factions.length}个):`);
    factions.forEach(f => {
      const rec = f.difficulty === '简单' ? '⭐' : '  ';
      console.log(`   ${rec} ${f.faction_name} (${f.faction_id}) - 最大玩家数: ${f.max_players}`);
    });
    
    // 验证部队（只显示rare稀有度）
    const [rareTroops] = await pool.query(`
      SELECT troop_id, troop_name, troop_type, max_troops
      FROM config_troops
      WHERE season = 'san_1' AND rarity = 'rare'
      ORDER BY troop_id
    `);
    
    console.log(`\n✅ Rare部队配置 (${rareTroops.length}个，用于初始选择):`);
    rareTroops.forEach(t => {
      console.log(`   ${t.troop_name} (${t.troop_id}) - ${t.troop_type}, 兵力: ${t.max_troops}`);
    });
    
    // 检查每个势力的rare部队数量
    console.log('\n📊 各势力Rare部队数量:');
    for (const faction of factions) {
      // 从faction_id提取势力编号：san_1_faction_1001 -> 1
      const factionNum = faction.faction_id.match(/faction_(\d)/)[1];
      const troopPattern = `san_1_troop_${factionNum}%`;
      
      const [count] = await pool.query(`
        SELECT COUNT(*) as count
        FROM config_troops
        WHERE season = 'san_1' 
          AND rarity = 'rare'
          AND troop_id LIKE ?
      `, [troopPattern]);
      
      console.log(`   ${faction.faction_name}: ${count[0].count}个`);
    }
    
    // 检查通用部队（troop_id包含_0）
    const [commonTroops] = await pool.query(`
      SELECT COUNT(*) as count
      FROM config_troops
      WHERE season = 'san_1' 
        AND rarity = 'rare'
        AND troop_id LIKE 'san_1_troop_0%'
    `);
    
    console.log(`   通用部队: ${commonTroops[0].count}个`);
    
  } catch (error) {
    console.error('❌ 验证失败:', error);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('⚔️  配置数据导入工具');
  console.log('========================================\n');
  
  try {
    // 检查文件是否存在
    if (!fs.existsSync(FACTIONS_JSON)) {
      throw new Error(`势力配置文件不存在: ${FACTIONS_JSON}`);
    }
    if (!fs.existsSync(TROOPS_JSON)) {
      throw new Error(`部队配置文件不存在: ${TROOPS_JSON}`);
    }
    if (!fs.existsSync(SKILLS_JSON)) {
      throw new Error(`技能配置文件不存在: ${SKILLS_JSON}`);
    }
    
    console.log('✓ 配置文件检查通过\n');
    
    // 导入数据
    await importFactions();
    await importTroops();
    await importSkills();
    
    // 验证结果
    await verifyImport();
    
    console.log('\n========================================');
    console.log('✅ 所有配置数据导入完成！');
    console.log('========================================\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ 导入失败:', error.message);
    console.error('========================================\n');
    process.exit(1);
  }
}

// 运行
main();
