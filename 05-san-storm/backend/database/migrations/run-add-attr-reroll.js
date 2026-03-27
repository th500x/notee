/**
 * 迁移脚本：为 players 表添加属性随机字段
 * 运行方式: node backend/database/migrations/run-add-attr-reroll.js
 */
require('dotenv').config({ path: __dirname + '/../../.env' });
const mysql = require('mysql2/promise');

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm',
    charset: 'utf8mb4',
  });

  try {
    // 检查字段是否已存在
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'players' AND COLUMN_NAME = 'attr_reroll_date'`,
      [process.env.DB_NAME || '05_san_storm']
    );

    if (cols.length > 0) {
      console.log('⚠️ 字段已存在，跳过迁移');
      await pool.end();
      return;
    }

    await pool.query(`
      ALTER TABLE players
        ADD COLUMN attr_reroll_date DATE COMMENT '上次属性随机日期（用于每日次数重置）' AFTER trait_modifier,
        ADD COLUMN attr_reroll_count INT DEFAULT 0 COMMENT '今日已随机次数（每日00:00重置，上限2）' AFTER attr_reroll_date,
        ADD COLUMN attr_reroll_batches JSON COMMENT '属性随机历史批次（与角色创建random_batches格式一致）' AFTER attr_reroll_count,
        ADD COLUMN attr_reroll_selected_batch INT COMMENT '当前选中的方案所在批次' AFTER attr_reroll_batches,
        ADD COLUMN attr_reroll_selected_index INT COMMENT '当前选中的方案索引（0-2）' AFTER attr_reroll_selected_batch
    `);

    console.log('✅ 迁移完成：属性随机字段已添加到 players 表');

    // 验证
    const [verify] = await pool.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'players' AND COLUMN_NAME LIKE 'attr_reroll_%'
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || '05_san_storm']
    );
    console.table(verify);

    await pool.end();
  } catch (err) {
    console.error('❌ 迁移失败:', err.message);
    await pool.end();
    process.exit(1);
  }
}

run();
