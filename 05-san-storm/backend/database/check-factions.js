const mysql = require('mysql2/promise');

async function checkFactions() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: '05_san_storm'
  });

  try {
    console.log('查询势力配置表...\n');
    
    const [rows] = await connection.query(`
      SELECT faction_id, faction_name, faction_leader, max_players, difficulty 
      FROM config_factions 
      ORDER BY faction_id
    `);
    
    console.log(`找到 ${rows.length} 个势力：\n`);
    rows.forEach(row => {
      console.log(`${row.faction_id}: ${row.faction_name}`);
      console.log(`  君主: ${row.faction_leader}`);
      console.log(`  最大玩家数: ${row.max_players}`);
      console.log(`  难度: ${row.difficulty}\n`);
    });
    
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    await connection.end();
  }
}

checkFactions();
