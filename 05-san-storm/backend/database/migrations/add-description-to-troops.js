/**
 * 数据库迁移脚本：为config_troops表添加description字段
 * 
 * 执行方式：node backend/database/migrations/add-description-to-troops.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('🔄 开始迁移：为config_troops表添加description字段...');

    // 检查字段是否已存在
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '05_san_storm' 
        AND TABLE_NAME = 'config_troops' 
        AND COLUMN_NAME = 'description'
    `);

    if (columns.length > 0) {
      console.log('✅ description字段已存在，无需迁移');
      return;
    }

    // 添加description字段
    await pool.query(`
      ALTER TABLE config_troops 
      ADD COLUMN description TEXT COMMENT '部队描述' 
      AFTER special_ability
    `);

    console.log('✅ 迁移完成：description字段已添加');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 执行迁移
migrate()
  .then(() => {
    console.log('✅ 所有迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 迁移过程出错:', error);
    process.exit(1);
  });
