/**
 * MySQL connection pool for 00_notee.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local'), override: true });
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../.env.production'), override: true });
}

const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '00_notee',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

const pool = mysql.createPool(dbConfig);

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    return true;
  } catch (error) {
    console.error('[life-resume/db] connection failed:', error.message);
    return false;
  }
}

async function testAccountsConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1 FROM accounts LIMIT 1');
    connection.release();
    return true;
  } catch (error) {
    console.error('[life-resume/accounts] table missing or unreadable:', error.message);
    return false;
  }
}

async function query(sql, params = []) {
  // MySQL 8 的预处理语句不接受 LIMIT ?。query 仍会转义参数。
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  testAccountsConnection,
  closePool,
  dbConfig,
};
