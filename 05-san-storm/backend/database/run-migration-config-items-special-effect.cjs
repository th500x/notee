/**
 * 一次性：为 config_items 增加 special_effect（已存在则跳过）
 * 用法: node backend/database/run-migration-config-items-special-effect.cjs
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '05_san_storm',
  charset: 'utf8mb4',
};

async function main() {
  let c;
  try {
    c = await mysql.createConnection(dbConfig);
    await c.query(
      `ALTER TABLE config_items
       ADD COLUMN special_effect VARCHAR(128) NULL DEFAULT NULL COMMENT '道具特殊效果标识' AFTER version`
    );
    console.log('✅ config_items.special_effect 已添加');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ special_effect 已存在，跳过');
    } else {
      throw e;
    }
  } finally {
    if (c) await c.end();
  }
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
