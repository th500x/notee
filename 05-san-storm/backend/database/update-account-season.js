/**
 * 更新账号赛季为 san_1
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: '05_san_storm',
  charset: 'utf8mb4'
};

async function updateAccountSeason() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 更新所有账号的赛季为 san_1
    const [result] = await connection.query(`
      UPDATE accounts
      SET current_season = 'san_1'
      WHERE current_season = 'san_0_m1' OR current_season IS NULL
    `);
    
    console.log(`✅ 更新完成: ${result.affectedRows} 个账号的赛季已更新为 san_1\n`);
    
    // 验证更新结果
    const [accounts] = await connection.query(`
      SELECT id, current_season, serverId
      FROM accounts
    `);
    
    console.log('当前账号列表:');
    accounts.forEach(account => {
      console.log(`- ID: ${account.id}, 赛季: ${account.current_season}, 服务器: ${account.serverId}`);
    });
    
  } catch (error) {
    console.error('❌ 更新失败:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

updateAccountSeason();
