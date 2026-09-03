/**
 * 创建测试账号
 */

const { pool } = require('./database/connection');

async function createTestAccount() {
  try {
    console.log('创建测试账号...');
    
    // 插入测试账号
    await pool.query(`
      INSERT INTO accounts (id, password, birthMonth, serverId, current_season, clientIP, machineId)
      VALUES ('TEST', 'test123', 1, 'S1-01', 'san_1', '127.0.0.1', 'test_machine_id')
      ON DUPLICATE KEY UPDATE id = id
    `);
    
    console.log('✅ 测试账号创建成功！');
    console.log('   账号ID: TEST');
    console.log('   密码: test123');
    console.log('   服务器: S1-01');
    console.log('   赛季: san_1');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 创建测试账号失败:', error.message);
    process.exit(1);
  }
}

createTestAccount();
