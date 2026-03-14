/**
 * 测试 JOIN 查询
 */

const { pool } = require('../database/connection');

async function testJoinQuery() {
  try {
    console.log(`\n========== 测试 JOIN 查询 ==========`);
    
    // 执行完整的 JOIN 查询
    const [result] = await pool.query(`
      SELECT 
        a.id, a.serverId,
        s.server_id, s.server_name,
        COALESCE(s.server_name, a.serverId) as serverName
      FROM accounts a
      LEFT JOIN config_servers s ON a.serverId = s.server_id
      WHERE a.id = '0IWD'
    `);

    if (result.length === 0) {
      console.log('没有结果');
      return;
    }

    console.log('\nJOIN 查询结果：');
    console.log(JSON.stringify(result[0], null, 2));

    console.log(`\n========================================\n`);

  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await pool.end();
  }
}

testJoinQuery();
