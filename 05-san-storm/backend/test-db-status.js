/**
 * 测试数据库中的用户状态
 */

const { pool } = require('./database/connection');

async function testUserStatus() {
  try {
    console.log('========== 查询最近注册的用户 ==========');
    const [users] = await pool.query(`
      SELECT id, status, registeredAt 
      FROM accounts 
      ORDER BY registeredAt DESC 
      LIMIT 5
    `);
    
    console.table(users);
    
    console.log('\n========== 状态统计 ==========');
    const [stats] = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM accounts 
      GROUP BY status
    `);
    
    console.table(stats);
    
    await pool.end();
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
}

testUserStatus();
