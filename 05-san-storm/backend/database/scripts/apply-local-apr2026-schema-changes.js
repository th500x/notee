/**
 * 本地一次性：按存在性执行
 * - drop-bandits-season-column.sql
 * - drop-config-texts-season-column.sql
 * - add-config-bonds-season-column.sql
 * - add-config-events-season-column.sql
 *
 * 用法（在 backend 目录）：node database/scripts/apply-local-apr2026-schema-changes.js
 * 生产请按同名 migrations/*.sql 顺序手工执行。
 */

const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function main() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: +process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm'
  });

  const [[dbRow]] = await c.query('SELECT DATABASE() AS d');
  const schema = dbRow.d;

  async function hasTable(t) {
    const [r] = await c.query(
      'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1',
      [schema, t]
    );
    return r.length > 0;
  }

  async function hasCol(t, col) {
    const [r] = await c.query(
      'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
      [schema, t, col]
    );
    return r.length > 0;
  }

  if ((await hasTable('bandits')) && (await hasCol('bandits', 'season'))) {
    await c.query('ALTER TABLE bandits DROP COLUMN season');
    console.log('OK: bandits.season dropped');
  } else {
    console.log('Skip: bandits.season (no table or column)');
  }

  if ((await hasTable('config_texts')) && (await hasCol('config_texts', 'season'))) {
    await c.query('ALTER TABLE config_texts DROP COLUMN season');
    console.log('OK: config_texts.season dropped');
  } else {
    console.log('Skip: config_texts.season');
  }

  if ((await hasTable('config_bonds')) && !(await hasCol('config_bonds', 'season'))) {
    await c.query(
      "ALTER TABLE config_bonds ADD COLUMN season VARCHAR(20) NULL COMMENT '赛季ID（从 bond_id 解析，如 san_1）'"
    );
    await c.query(
      "UPDATE config_bonds SET season = SUBSTRING_INDEX(bond_id, '_', 2) WHERE season IS NULL OR season = ''"
    );
    await c.query(
      "ALTER TABLE config_bonds MODIFY COLUMN season VARCHAR(20) NOT NULL COMMENT '赛季ID（从 bond_id 解析）'"
    );
    await c.query('ALTER TABLE config_bonds ADD INDEX idx_season (season)');
    console.log('OK: config_bonds.season added');
  } else if (await hasCol('config_bonds', 'season')) {
    console.log('Skip: config_bonds.season already present');
  } else {
    console.log('Skip: config_bonds (no table)');
  }

  if ((await hasTable('config_events')) && !(await hasCol('config_events', 'season'))) {
    await c.query(
      "ALTER TABLE config_events ADD COLUMN season VARCHAR(20) NULL COMMENT '赛季ID（从 event_id 解析，如 san_1）'"
    );
    await c.query(
      "UPDATE config_events SET season = SUBSTRING_INDEX(event_id, '_', 2) WHERE season IS NULL OR season = ''"
    );
    await c.query(
      "ALTER TABLE config_events MODIFY COLUMN season VARCHAR(20) NOT NULL COMMENT '赛季ID（从 event_id 解析）'"
    );
    await c.query('ALTER TABLE config_events ADD INDEX idx_season (season)');
    console.log('OK: config_events.season added');
  } else if (await hasCol('config_events', 'season')) {
    console.log('Skip: config_events.season already present');
  } else {
    console.log('Skip: config_events (no table)');
  }

  await c.end();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
