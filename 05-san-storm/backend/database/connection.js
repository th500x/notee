/**
 * MySQL 数据库连接模块
 * 
 * @description 管理MySQL数据库连接池
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const mysql = require('mysql2/promise');

/**
 * 数据库配置
 *
 * timezone（CR P3，2026-04-29 初版 → 04-29 修订）：
 *   告诉 mysql2「DB session 中的 DATETIME / TIMESTAMP 字符串应当按哪个时区解析」。
 *
 *   **正确口径**：mysql2.timezone **必须等于 DB session 实际的时区**，否则写入字符串
 *   与读出字符串的解释会错位（DB 写 NOW() 用 session 时区落地，mysql2 读出按 mysql2.timezone
 *   解释，两者不同 → 时间在 JS 侧偏移）。
 *
 *   **04-29 初版的 bug**：硬编码 '+08:00'，假设运营时区永远是北京时间；但本地开发者 OS 可能
 *   并非 +08（如 +07 曼谷），XAMPP 的 MySQL session 时区跟随 OS（默认 SYSTEM）也是 +07，
 *   被 mysql2 按 +08 解析后会偏 1 小时——前端表现为"刚做的战斗显示 1 小时前"。
 *
 *   **修订后默认值 'local'**：
 *     - mysql2 把 DB DATETIME 字符串按**运行进程本地时区**解析；
 *     - 本地：进程时区（OS）= XAMPP MySQL session 时区（SYSTEM=OS） → 自动对齐；
 *     - 生产：进程时区（容器 UTC）= 生产 MySQL session 时区（容器 UTC） → 自动对齐；
 *     - 跨时区一致性靠"进程与 DB session 在同一台机 / 同一容器栈中天然相同"实现，
 *       任何机器都不需要单独配置；
 *     - 极端场景（DB session 与进程时区刻意分离）才用 `DB_TIMEZONE` 环境变量手动覆盖。
 *
 *   前端拿到 `created_at.toISOString()` 永远是 UTC ISO，再用 `new Date(iso)` 转成
 *   浏览器本地时区显示——只要"DB session 时区 = 进程时区"成立，玩家看到的"X 分钟前"就是对的。
 *
 * dateStrings: ['DATE']（不变）：
 *   仅对 **DATE 列**（如 road_move_free_date、attr_reroll_date 等）保留字符串原文（'YYYY-MM-DD'），
 *   不再被 mysql2 转成 0:00 + 时区偏移的 Date 对象——避免
 *   `new Date(dateRow).toISOString().slice(0,10)` 在不同 server 时区下偏一天的隐患。
 *   DATETIME / TIMESTAMP 列保持原行为（返回 JS Date）。
 */
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '05_san_storm',
  charset: 'utf8mb4',
  timezone: process.env.DB_TIMEZONE || 'local',
  dateStrings: ['DATE'],
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
    console.log(`🕐 时区: ${dbConfig.timezone}（mysql2 → DB DATETIME 解析方向；'local' 表示按进程本地时区，与 DB session 自然对齐） / DATE 列保留字符串原文`);
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
