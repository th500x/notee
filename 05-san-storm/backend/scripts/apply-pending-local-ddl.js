/**
 * 按顺序执行指定迁移文件（本地库）。列已存在则跳过。
 * node scripts/apply-pending-local-ddl.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { pool } = require('../database/connection');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

/** 仅 RENAME：源表不存在时跳过（新库或未走过旧表名） */
const MIGRATION_FILES_SKIP_NO_SUCH_TABLE = new Set([
  'rename-faction-bulletin-entries-to-faction-bulletins.sql',
  'rename-temp-character-ranking-snapshots-to-temp-character-ranking.sql',
  'rename-statistics-to-player-statistics.sql',
  'rename-temp-ranking-snapshots-to-temp-event-ranking.sql',
]);

/** 含 SET/PREPARE/EXECUTE 的多句迁移须 multipleStatements（pool.query 默认仅执行首句） */
const MIGRATION_FILES_NEED_MULTIPLE_STATEMENTS = new Set([
  'cities-drop-fk-parent-city.sql',
  'player-garrison-composite-city-primary-key.sql',
  'seed-system-player-sys1.sql',
]);

/** 多句 DDL/DML（无 PROCEDURE）；逐句 pool.query，避免 MariaDB 单包拒执行 */
const MIGRATION_FILES_SPLIT_STATEMENTS = new Set([
  'config-positions-drop-legacy-bonus-columns-json-type.sql',
  'add-faction-bulletins-category.sql',
]);

async function runMigrationSql(sql, file) {
  if (MIGRATION_FILES_NEED_MULTIPLE_STATEMENTS.has(file)) {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || '05_san_storm',
      charset: 'utf8mb4',
      multipleStatements: true,
    });
    try {
      await conn.query(sql);
    } finally {
      await conn.end();
    }
    return;
  }
  await pool.query(sql);
}

const MIGRATION_FILES = [
  'cities-delete-wilderness-market-rows.sql',
  'cities-drop-fk-parent-city.sql',
  'cities-add-wilderness-market-lord-columns.sql',
  'cities-drop-parent-column-narrow-city-type.sql',
  'drop-config-events-tags.sql',
  'config-events-trigger-probability-nullable.sql',
  'add-players-on-duty-city-id.sql',
  'add-players-main-city-id.sql',
  'add-players-main-city-changed-at.sql',
  'add-config-servers-game-time.sql',
  'create-chats-table.sql',
  'add-veteran-columns.sql',
  'migrate-players-items-item-badge-to-season-badge.sql',
  'rename-config-items-item-badge-to-item-season-badge.sql',
  'add-config-items-item-type-season-badge.sql',
  'add-cities-description.sql',
  'add-temp-ranking-snapshots-updated-at.sql',
  'add-temp-ranking-snapshots-frozen-deltas.sql',
  'add-temp-ranking-snapshots-baseline-date.sql',
  'player-garrison-composite-city-primary-key.sql',
  'cities-rename-commerce-columns-to-trading.sql',
  'factions-rename-reserve-silver-food.sql',
  'factions-add-totals-and-supply-columns.sql',
  'player-cards-add-main-city-barracks-storage.sql',
  'player-cards-drop-barracks-sort.sql',
  'player-events-add-san-gong-tribute-daily.sql',
  'player-events-add-san-gong-stipend-claim-date.sql',
  'create-road-encounters.sql',
  'add-players-road-state.sql',
  'add-players-road-client-notice.sql',
  'road-encounters-add-authoritative-resolution-json.sql',
  'player-events-explore-session-lock.sql',
  'config-events-add-min-reputation-event-hint.sql',
  'config-events-drop-min-position-level.sql',
  'config-factions-add-initial-city-id.sql',
  'player-progress-drop-tutorial-columns.sql',
  'add-player-progress-bandit-progress.sql',
  'create-bandits-table.sql',
  'alter-battles-add-pve-bandit-type.sql',
  'create-wars-pvp-table.sql',
  'alter-battles-add-pvp-war-id.sql',
  'rename-faction-bulletin-entries-to-faction-bulletins.sql',
  'create-faction-bulletins.sql',
  'add-faction-bulletins-category.sql',
  'player-events-add-san-gong-document-daily.sql',
  'rename-temp-character-ranking-snapshots-to-temp-character-ranking.sql',
  'rename-statistics-to-player-statistics.sql',
  'rename-temp-ranking-snapshots-to-temp-event-ranking.sql',
  'config-positions-drop-legacy-bonus-columns-json-type.sql',
  'seed-system-player-sys1.sql',
];

function stripSqlComments(sql) {
  return sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n')
    .trim();
}

(async () => {
  const dir = path.join(__dirname, '../database/migrations');
  for (const file of MIGRATION_FILES) {
    const full = path.join(dir, file);
    const raw = fs.readFileSync(full, 'utf8');
    const sql = stripSqlComments(raw);
    if (!sql) {
      console.log(`SKIP (empty): ${file}`);
      continue;
    }
    try {
      if (MIGRATION_FILES_SPLIT_STATEMENTS.has(file)) {
        const statements = sql
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean);
        for (const stmt of statements) {
          await pool.query(stmt);
        }
      } else {
        await runMigrationSql(sql, file);
      }
      console.log(`OK: ${file}`);
    } catch (e) {
      if (
        MIGRATION_FILES_SKIP_NO_SUCH_TABLE.has(file) &&
        (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146)
      ) {
        console.log(`SKIP (no source table): ${file}`);
      } else if (
        e.code === 'ER_DUP_FIELDNAME' ||
        e.code === 'ER_TABLE_EXISTS_ERROR' ||
        e.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
        e.code === 'ER_BAD_FIELD_ERROR' ||
        e.errno === 1091 ||
        /Duplicate column name/i.test(e.message || '') ||
        /already exists/i.test(e.message || '') ||
        /Can't DROP/i.test(e.message || '') ||
        /Unknown column ['`]?commerce['`]?/i.test(e.message || '') ||
        /Unknown column ['`]?silver_reserve['`]?/i.test(e.message || '') ||
        /Unknown column ['`]?food_reserve['`]?/i.test(e.message || '')
      ) {
        console.log(`SKIP (already applied): ${file}`);
      } else {
        console.error(`FAIL: ${file}`, e.message);
        process.exit(1);
      }
    }
  }
  process.exit(0);
})();
