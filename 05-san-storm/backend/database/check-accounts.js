/**
 * 检查账号表
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: '05_san_storm',
  charset: 'utf8mb4'
};

async function checkAccounts() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 查询所有账号
    const [accounts] = await connection.query(`
      SELECT *
      FROM accounts
      ORDER BY id DESC
      LIMIT 10
    `);
    
    console.log(`📊 账号总数: ${accounts.length}\n`);
    
    if (accounts.length > 0) {
      console.log('最近的账号:');
      accounts.forEach(account => {
        console.log(`- ID: ${account.id}`);
        console.log(`  所有字段:`, JSON.stringify(account, null, 2));
        console.log('');
      });
    } else {
      console.log('❌ 没有找到账号数据');
    }
    
  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

checkAccounts();
