/**
 * 一次性：建 faction_reserve、为每势力补 pool 行（余额从已删列无法恢复时默认为 0）
 * node scripts/apply-faction-reserve-unified.js
 */
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS faction_reserve (
  faction_id VARCHAR(50) NOT NULL COMMENT '势力ID',
  category VARCHAR(32) NOT NULL COMMENT 'pool=余额; war_start|march_food|stipend_bonus=累计出账',
  silver BIGINT NOT NULL DEFAULT 0,
  food BIGINT NOT NULL DEFAULT 0,
  recovery_applied_date DATE NULL COMMENT '仅 pool',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (faction_id, category),
  INDEX idx_faction (faction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='势力银粮储备';
`;

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm',
    charset: 'utf8mb4',
  });
  try {
    await conn.query(CREATE_SQL);
    console.log('OK: CREATE faction_reserve');

    const [factions] = await conn.query('SELECT id FROM factions');
    for (const { id } of factions) {
      await conn.query(
        `INSERT IGNORE INTO faction_reserve (faction_id, category, silver, food)
         VALUES (?, 'pool', 0, 0)`,
        [id],
      );
    }
    console.log(`OK: ensured pool rows for ${factions.length} factions`);

    const [usageExists] = await conn.query("SHOW TABLES LIKE 'faction_reserve_usage'");
    if (usageExists.length) {
      await conn.query(
        `INSERT INTO faction_reserve (faction_id, category, silver, food)
         SELECT faction_id, category, silver_spent, food_spent FROM faction_reserve_usage
         ON DUPLICATE KEY UPDATE
           silver = GREATEST(faction_reserve.silver, VALUES(silver)),
           food = GREATEST(faction_reserve.food, VALUES(food))`,
      );
      await conn.query('DROP TABLE faction_reserve_usage');
      console.log('OK: migrated faction_reserve_usage');
    } else {
      console.log('SKIP: no faction_reserve_usage table');
    }

    const [cols] = await conn.query("SHOW COLUMNS FROM factions LIKE 'reserve_silver'");
    if (cols.length) {
      await conn.query(
        `INSERT INTO faction_reserve (faction_id, category, silver, food, recovery_applied_date)
         SELECT id, 'pool', COALESCE(reserve_silver,0), COALESCE(reserve_food,0), reserve_recovery_applied_date
         FROM factions
         ON DUPLICATE KEY UPDATE
           silver = VALUES(silver),
           food = VALUES(food),
           recovery_applied_date = COALESCE(VALUES(recovery_applied_date), faction_reserve.recovery_applied_date)`,
      );
      await conn.query('ALTER TABLE factions DROP COLUMN reserve_silver');
      await conn.query('ALTER TABLE factions DROP COLUMN reserve_food');
      await conn.query('ALTER TABLE factions DROP COLUMN reserve_recovery_applied_date');
      console.log('OK: migrated from factions.reserve_* and dropped columns');
    } else {
      console.log('SKIP: factions.reserve_silver already dropped');
    }
  } finally {
    await conn.end();
  }
  process.exit(0);
})();
