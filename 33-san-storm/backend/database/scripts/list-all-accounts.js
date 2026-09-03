/**
 * 列出所有账号
 */

const { pool } = require('../connection');

async function listAllAccounts() {
  try {
    console.log(`\n========== 所有账号列表 ==========`);
    
    const [accounts] = await pool.query(`
      SELECT id, serverId, birthMonth, registeredAt
      FROM accounts
      ORDER BY registeredAt DESC
      LIMIT 10
    `);

    if (accounts.length === 0) {
      console.log('没有账号');
      return;
    }

    console.log(`\n共 ${accounts.length} 个账号（最近10个）：\n`);
    accounts.forEach((account, index) => {
      console.log(`${index + 1}. ID: ${account.id}, 服务器: ${account.serverId}, 生日: ${account.birthMonth}月, 注册: ${account.registeredAt}`);
    });

    console.log(`\n========================================\n`);

  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await pool.end();
  }
}

listAllAccounts();
