/**
 * 验证势力数据
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: '05_san_storm',
  charset: 'utf8mb4'
};

async function verifyFactions() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 查询所有势力
    const [factions] = await connection.query(`
      SELECT * FROM config_factions
      ORDER BY faction_id
    `);
    
    console.log(`📊 势力总数: ${factions.length}\n`);
    
    if (factions.length > 0) {
      console.log('势力列表:');
      factions.forEach(faction => {
        console.log(`- ${faction.faction_name} (${faction.faction_id})`);
        console.log(`  赛季: ${faction.season}`);
        console.log(`  最大玩家数: ${faction.max_players}`);
        console.log(`  推荐: ${faction.recommended}`);
        console.log(`  难度: ${faction.difficulty}`);
        console.log('');
      });
    } else {
      console.log('❌ 没有找到势力数据');
    }
    
  } catch (error) {
    console.error('❌ 验证失败:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

verifyFactions();
