/**
 * 初始化测试小城（新野）
 * 
 * 用法: node backend/database/scripts/init-test-city.js
 */

const { pool } = require('../connection');

async function initTestCity() {
  try {
    // 插入测试小城：新野
    await pool.query(`
      INSERT INTO cities (id, season, city_name, city_type, faction_id, region, position_x, position_y,
        population, commerce, agriculture, military, culture, defense, garrison_capacity,
        npc_max_rarity, status)
      VALUES (?, ?, ?, ?, NULL, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, 'neutral')
      ON DUPLICATE KEY UPDATE
        city_name = VALUES(city_name),
        npc_max_rarity = VALUES(npc_max_rarity),
        status = VALUES(status)
    `, [
      'san_1_city_3_xinye', 'san_1', '新野', 'city_small', '南阳', 6, 7,
      3000, 30, 40, 20, 15, 40, 20,
      'rare'
    ]);

    console.log('✅ 测试小城「新野」初始化完成');
    console.log('   ID: san_1_city_3_xinye');
    console.log('   类型: city_small');
    console.log('   NPC稀有度上限: rare');
    console.log('   状态: neutral（中立）');

    // 生成 NPC 守军
    const cityService = require('../../services/cityService');
    const result = await cityService.generateNpcGarrison('san_1_city_3_xinye');
    console.log(`   NPC守军: ${result.npcCount} 支部队已生成`);
    result.npcGarrison.forEach((u, i) => {
      const charName = u.character ? u.character.courtesyName || u.character.name || '将领' : '无将领';
      console.log(`     [${i}] ${u.troopName}(${u.rarity}) - ${charName}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  }
}

initTestCity();
