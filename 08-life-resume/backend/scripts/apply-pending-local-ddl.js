/**
 * Apply pending DDL migrations (local dev or production).
 * Usage: node scripts/apply-pending-local-ddl.js
 *
 * Production (宝塔已建空库):
 *   backend/.env 设 DB_USER/DB_PASSWORD/DB_NAME，并 MIGRATION_ASSUME_DB_EXISTS=1
 *   库名须与 DB_NAME 一致，推荐 00_notee（与 05_san_storm 同风格）
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local'), override: true });
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../.env.production'), override: true });
}

const MIGRATION_FILES = [
  '001-initial-schema.sql',
  '002-life-entries-location-place.sql',
  '003-life-entries-is-pinned.sql',
  '004-life-entries-life-stage-unknown.sql',
  '005-life-profiles-region-duplicate-usernames.sql',
  '006-life-entries-tag-travel-to-yuji.sql',
  '007-life-profiles-life-path.sql',
  '008-life-entry-media-document.sql',
  '009-life-entry-series.sql',
  '010-eth-ma-web-push.sql',
  '011-eth-ma-1h.sql',
  '012-accounts.sql',
  '013-eth-ma-trade-logs.sql',
  '014-accounts-birthday.sql',
  '015-wallet-asset-daily.sql',
  '016-eth-subscribe-week-signals.sql',
];

const DEFAULT_DB_NAME = '00_notee';

/** 已成功跑过的迁移记在此表；避免幂等失败掩盖真正的数据破坏语句（如历史 004 的 DELETE）。 */
const SCHEMA_MIGRATIONS_DDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

function resolveDbName() {
  return String(process.env.DB_NAME || DEFAULT_DB_NAME).trim() || DEFAULT_DB_NAME;
}

function prepareSql(rawSql, dbName) {
  let sql = rawSql.replace(/`00_notee`/g, `\`${dbName}\``);
  if (process.env.MIGRATION_ASSUME_DB_EXISTS === '1') {
    sql = sql
      .replace(/CREATE DATABASE IF NOT EXISTS[^;]+;\s*/gi, '')
      .replace(/^\s*USE\s+`[^`]+`\s*;\s*/gim, '');
  }
  return sql;
}

/** 拒绝无 WHERE 的 DELETE / 任意 TRUNCATE（004 类雷：批跑时每次都会成功清空）。带 WHERE 的定点清理仍允许。 */
function assertNoDestructiveWipe(file, rawSql) {
  const stripped = rawSql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const statements = stripped.split(';').map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    if (/^TRUNCATE\b/i.test(stmt)) {
      throw new Error(`[migrate] refused ${file}: TRUNCATE is not allowed in migrations`);
    }
    if (/^DELETE\s+FROM\b/i.test(stmt) && !/\bWHERE\b/i.test(stmt)) {
      throw new Error(
        `[migrate] refused ${file}: unconditional DELETE FROM (missing WHERE) is not allowed`
      );
    }
  }
}

function isAlreadyAppliedError(err) {
  return (
    err &&
    (err.code === 'ER_DUP_FIELDNAME' ||
      err.code === 'ER_DUP_KEYNAME' ||
      err.code === 'ER_TABLE_EXISTS_ERROR' ||
      err.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
      err.errno === 1060 ||
      err.errno === 1061 ||
      err.errno === 1050 ||
      err.errno === 1091)
  );
}

async function ensureSchemaMigrations(conn) {
  await conn.query(SCHEMA_MIGRATIONS_DDL);
}

async function isRecorded(conn, file) {
  const [rows] = await conn.query(
    'SELECT 1 AS ok FROM schema_migrations WHERE filename = ? LIMIT 1',
    [file]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function recordApplied(conn, file) {
  await conn.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [file]);
}

async function applyMigration(conn, file, dbName) {
  if (await isRecorded(conn, file)) {
    console.log(`[migrate] SKIP ${file} (recorded in schema_migrations)`);
    return;
  }
  const filePath = path.join(__dirname, '../database/migrations', file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration not found: ${file}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  assertNoDestructiveWipe(file, raw);
  const sql = prepareSql(raw, dbName);
  console.log(`[migrate] applying ${file} on ${dbName} ...`);
  try {
    await conn.query(sql);
    await recordApplied(conn, file);
    console.log(`[migrate] OK ${file}`);
  } catch (err) {
    if (isAlreadyAppliedError(err)) {
      await recordApplied(conn, file);
      console.log(`[migrate] SKIP ${file} (already applied, now recorded)`);
      return;
    }
    throw err;
  }
}

async function main() {
  const dbName = resolveDbName();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.MIGRATION_ASSUME_DB_EXISTS === '1' ? dbName : undefined,
    charset: 'utf8mb4',
    multipleStatements: true,
  });

  try {
    if (process.env.MIGRATION_ASSUME_DB_EXISTS !== '1') {
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await conn.query(`USE \`${dbName}\``);
    }
    await ensureSchemaMigrations(conn);
    for (const file of MIGRATION_FILES) {
      await applyMigration(conn, file, dbName);
    }
    console.log(`[migrate] all pending migrations applied (database: ${dbName})`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[migrate] failed:', err.message);
  process.exit(1);
});
