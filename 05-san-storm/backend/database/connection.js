/**
 * MySQL 数据库连接模块
 * 
 * @description 管理MySQL数据库连接池
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const mysql = require('mysql2/promise');

/**
 * 数据库配置
 */
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '05_san_storm',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

/**
 * 创建连接池
 */
const pool = mysql.createPool(dbConfig);

/**
 * 测试数据库连接
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL数据库连接成功');
    console.log(`📍 数据库: ${dbConfig.database}`);
    console.log(`🔗 主机: ${dbConfig.host}:${dbConfig.port}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL数据库连接失败:', error.message);
    console.error('请检查：');
    console.error('1. MySQL服务是否启动');
    console.error('2. .env 配置是否正确');
    console.error('3. 数据库是否已创建');
    return false;
  }
}

/**
 * 执行查询
 * @param {string} sql - SQL语句
 * @param {Array} params - 参数
 * @returns {Promise<Array>} 查询结果
 */
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('[Database] 查询失败:', error.message);
    throw error;
  }
}

/**
 * 执行事务
 * @param {Function} callback - 事务回调函数
 * @returns {Promise<any>} 事务结果
 */
async function transaction(callback) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('[Database] 事务失败:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 关闭连接池
 */
async function closePool() {
  try {
    await pool.end();
    console.log('✅ 数据库连接池已关闭');
  } catch (error) {
    console.error('❌ 关闭连接池失败:', error.message);
  }
}

// 导出
module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  closePool
};
