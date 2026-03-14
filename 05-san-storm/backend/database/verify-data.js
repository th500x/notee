/**
 * 验证导入的数据
 */

const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: '05_san_storm',
  charset: 'utf8mb4'
};

async function verifyData() {
  let connection;
  
  try {
    console.log('连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // ========== 验证将领数据 ==========
    console.log('========== 验证将领数据 ==========\n');
    
    // 统计总数
    const [countResult] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(courtesy_name) as with_courtesy_name,
        COUNT(faction) as with_faction,
        COUNT(birth_year) as with_birth_year,
        COUNT(death_year) as with_death_year,
        COUNT(stage) as with_stage,
        COUNT(character_type) as with_character_type
      FROM config_characters
    `);
    
    console.log('将领统计：');
    console.log(`  总数: ${countResult[0].total}`);
    console.log(`  有字号: ${countResult[0].with_courtesy_name}`);
    console.log(`  有势力: ${countResult[0].with_faction}`);
    console.log(`  有出生年: ${countResult[0].with_birth_year}`);
    console.log(`  有卒年: ${countResult[0].with_death_year}`);
    console.log(`  有生涯: ${countResult[0].with_stage}`);
    console.log(`  有将领类型: ${countResult[0].with_character_type}\n`);
    
    // 查看刘备的完整数据
    const [liubei] = await connection.query(`
      SELECT 
        character_id, character_name, courtesy_name, faction,
        luck, courage, combat, command, intelligence, politics, charm,
        birth_year, death_year, stage, character_type,
        skill_1, skill_2, troop_affinity, trait,
        character_extra
      FROM config_characters 
      WHERE character_name = '刘备'
    `);
    
    if (liubei.length > 0) {
      const char = liubei[0];
      console.log('刘备数据示例：');
      console.log(`  ID: ${char.character_id}`);
      console.log(`  姓名: ${char.character_name}`);
      console.log(`  字: ${char.courtesy_name}`);
      console.log(`  势力: ${char.faction}`);
      console.log(`  属性: 运${char.luck/10} 勇${char.courage/10} 武${char.combat/10} 统${char.command/10} 智${char.intelligence/10} 政${char.politics/10} 魅${char.charm/10}`);
      console.log(`  生卒: ${char.birth_year}-${char.death_year}`);
      console.log(`  生涯: ${char.stage}`);
      console.log(`  类型: ${char.character_type}`);
      console.log(`  技能: ${char.skill_1}, ${char.skill_2}`);
      console.log(`  兵种亲和: ${char.troop_affinity}`);
      console.log(`  特性: ${char.trait}`);
      
      const extra = JSON.parse(char.character_extra);
      console.log(`  额外信息:`);
      console.log(`    - 特性修正: ${extra.trait_modifier}`);
      console.log(`    - 士气: ${extra.morale}`);
      console.log(`    - 羁绊: ${extra.bonds.join(', ')}`);
      console.log(`    - 传记: ${extra.biography}`);
      console.log(`    - 描述: ${extra.description.substring(0, 50)}...\n`);
    }
    
    // ========== 验证部队数据 ==========
    console.log('========== 验证部队数据 ==========\n');
    
    // 统计总数
    const [troopCount] = await connection.query(`
      SELECT COUNT(*) as total FROM config_troops
    `);
    
    console.log(`部队总数: ${troopCount[0].total}\n`);
    
    // 查看燕云十八的完整数据
    const [yanyun] = await connection.query(`
      SELECT 
        troop_id, troop_name, rarity, troop_type,
        attack, defense, max_troops, speed, movement, \`range\`,
        special_ability, description
      FROM config_troops 
      WHERE troop_name = '燕云十八'
    `);
    
    if (yanyun.length > 0) {
      const troop = yanyun[0];
      console.log('燕云十八数据示例：');
      console.log(`  ID: ${troop.troop_id}`);
      console.log(`  名称: ${troop.troop_name}`);
      console.log(`  稀有度: ${troop.rarity}`);
      console.log(`  兵种: ${troop.troop_type}`);
      console.log(`  属性: 攻${troop.attack/10} 防${troop.defense/10} 速${troop.speed} 移${troop.movement} 距${troop.range}`);
      console.log(`  最大兵力: ${troop.max_troops}`);
      console.log(`  描述: ${troop.description}`);
      
      const ability = JSON.parse(troop.special_ability);
      console.log(`  特殊能力:`);
      console.log(`    - 武器类型: ${ability.weapon_type}`);
      console.log(`    - 克制: 步${ability.counters.infantry} 骑${ability.counters.cavalry} 弓${ability.counters.archer} 攻${ability.counters.siege}`);
      console.log(`    - 适应: 平${ability.adaptation.plain} 丘${ability.adaptation.hill} 林${ability.adaptation.forest} 城${ability.adaptation.siege}`);
      console.log(`    - 技能: ${ability.skills.join(', ')}`);
      console.log(`    - 特效: 攻击=${ability.effects.attack}, 投射=${ability.effects.projectile}, 命中=${ability.effects.hit}\n`);
    }
    
    // 验证special_ability JSON结构
    console.log('验证部队special_ability JSON结构（前5个）：');
    const [troops] = await connection.query(`
      SELECT 
        troop_name,
        JSON_EXTRACT(special_ability, '$.weapon_type') as weapon_type,
        JSON_EXTRACT(special_ability, '$.counters.cavalry') as cavalry_counter,
        JSON_EXTRACT(special_ability, '$.adaptation.plain') as plain_adapt,
        JSON_EXTRACT(special_ability, '$.skills') as skills
      FROM config_troops 
      LIMIT 5
    `);
    
    troops.forEach(t => {
      console.log(`  ${t.troop_name}: 武器=${t.weapon_type}, 骑克=${t.cavalry_counter}, 平原=${t.plain_adapt}, 技能=${t.skills}`);
    });
    
    console.log('\n🎉 数据验证完成！');
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行验证
verifyData();
