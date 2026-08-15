/**
 * 只连 05_san_storm.accounts（及注册时可能用到的 config_servers）。
 * 不启动 05 进程；与 11_life_resume 业务库分开。
 */

const mysql = require('mysql2/promise');

const accountsDbConfig = {
  host: process.env.SAN_STORM_DB_HOST || process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.SAN_STORM_DB_PORT || process.env.DB_PORT || '3306', 10),
  user: process.env.SAN_STORM_DB_USER || process.env.DB_USER || 'root',
  password: process.env.SAN_STORM_DB_PASSWORD !== undefined
    ? process.env.SAN_STORM_DB_PASSWORD
    : (process.env.DB_PASSWORD || ''),
  database: process.env.SAN_STORM_DB_NAME || '05_san_storm',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

const accountsPool = mysql.createPool(accountsDbConfig);

async function testAccountsConnection() {
  try {
    const connection = await accountsPool.getConnection();
    await connection.query('SELECT 1 FROM accounts LIMIT 1');
    connection.release();
    return true;
  } catch (error) {
    console.error('[life-resume/accounts-db] connection failed:', error.message);
    return false;
  }
}

module.exports = {
  accountsPool,
  accountsDbConfig,
  testAccountsConnection,
};
