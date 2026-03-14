/**
 * 测试 API 返回的数据
 */

const { pool } = require('../database/connection');

async function testAPI() {
  try {
    console.log(`\n========== 测试 /api/auth/users 查询 ==========`);
    
    // 模拟 API 查询
    const [accounts] = await pool.query(`
      SELECT 
        a.id, a.birthMonth, a.serverId, a.current_season,
        a.machineId, a.clientIP, a.province, a.city,
        a.status, a.banReason, a.banUntil,
        a.registeredAt, a.lastLoginAt, a.lastActiveAt, a.loginCount,
        COALESCE(s.server_name, a.serverId) as serverName
      FROM accounts a
      LEFT JOIN config_servers s ON a.serverId = s.server_id
      WHERE a.id = '058Z'
    `);

    if (accounts.length === 0) {
      console.log('账号不存在');
      return;
    }

    const account = accounts[0];
    console.log('\n返回的数据：');
    console.log(JSON.stringify(account, null, 2));

    console.log(`\n关键字段：`);
    console.log(`serverId: ${account.serverId}`);
    console.log(`serverName: ${account.serverName}`);

    console.log(`\n========================================\n`);

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await pool.end();
  }
}

testAPI();
