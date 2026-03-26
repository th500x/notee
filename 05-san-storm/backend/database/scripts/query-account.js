/**
 * 查询账号信息脚本
 */

const { pool } = require('../database/connection');

async function queryAccount(accountId) {
  try {
    console.log(`\n========== 账号信息 ==========`);
    
    // 查询账号信息
    const [accounts] = await pool.query(`
      SELECT 
        id, serverId, current_season, birthMonth,
        machineId, clientIP, province, city,
        status, registeredAt, lastLoginAt, loginCount
      FROM accounts
      WHERE id = ?
    `, [accountId]);

    if (accounts.length === 0) {
      console.log(`账号 ${accountId} 不存在`);
      return;
    }

    const account = accounts[0];
    console.log(`账号ID: ${account.id}`);
    console.log(`服务器ID: ${account.serverId}`);
    console.log(`当前赛季: ${account.current_season}`);
    console.log(`生日月份: ${account.birthMonth}月`);
    console.log(`状态: ${account.status}`);
    console.log(`注册时间: ${account.registeredAt}`);
    console.log(`最后登录: ${account.lastLoginAt}`);
    console.log(`登录次数: ${account.loginCount}`);
    console.log(`机器指纹: ${account.machineId}`);
    console.log(`IP地址: ${account.clientIP}`);
    console.log(`省份: ${account.province || '未知'}`);
    console.log(`城市: ${account.city || '未知'}`);

    console.log(`\n========================================\n`);

  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await pool.end();
  }
}

// 从命令行参数获取账号ID
const accountId = process.argv[2];

if (!accountId) {
  console.log('用法: node query-account.js <账号ID>');
  console.log('示例: node query-account.js 07I2');
  process.exit(1);
}

queryAccount(accountId);
