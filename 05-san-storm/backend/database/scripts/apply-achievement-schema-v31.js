/**
 * 一次性：对齐 config_achievements 至 v3.1（display_effect；移除 unlock_title/is_hidden）
 * 用法：node backend/database/scripts/apply-achievement-schema-v31.js
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '05_san_storm',
};

async function columnExists(conn, table, col) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbConfig.database, table, col],
  );
  return rows.length > 0;
}

async function main() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    if (!(await columnExists(conn, 'config_achievements', 'display_effect'))) {
      await conn.query(
        `ALTER TABLE config_achievements
         ADD COLUMN display_effect VARCHAR(32) NULL
         COMMENT '大地图立绘显示特效：金色/红色/绿色/黑色等'
         AFTER special_effect_desc`,
      );
      console.log('✅ ADD display_effect');
    } else {
      console.log('⏭️ display_effect 已存在');
    }
    for (const col of ['unlock_title', 'is_hidden']) {
      if (await columnExists(conn, 'config_achievements', col)) {
        await conn.query(`ALTER TABLE config_achievements DROP COLUMN ${col}`);
        console.log(`✅ DROP ${col}`);
      } else {
        console.log(`⏭️ ${col} 已不存在`);
      }
    }
    const [cols] = await conn.query('SHOW COLUMNS FROM config_achievements');
    console.log('列:', cols.map((r) => r.Field).join(', '));
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
