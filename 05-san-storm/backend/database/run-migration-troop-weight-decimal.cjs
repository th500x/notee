/**
 * config_troops.troop_weight：INT → DECIMAL(5,2)
 * 用法: node backend/database/run-migration-troop-weight-decimal.cjs
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
  const c = await mysql.createConnection(dbConfig);
  try {
    await c.query(
      `ALTER TABLE config_troops
       MODIFY COLUMN troop_weight DECIMAL(5,2) NOT NULL DEFAULT 1.00
       COMMENT '兵力权重（等效兵力=max_troops×troop_weight，可小数）'`
    );
    console.log('✅ config_troops.troop_weight 已改为 DECIMAL(5,2)');
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
