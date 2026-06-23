/**
 * Apply pending DDL migrations (local dev or production).
 * Usage: node scripts/apply-pending-local-ddl.js
 *
 * Production (宝塔已建空库):
 *   backend/.env 设 DB_USER/DB_PASSWORD/DB_NAME，并 MIGRATION_ASSUME_DB_EXISTS=1
 *   库名须与 DB_NAME 一致，推荐 11_life_resume（与 05_san_storm 同风格）
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
];

const DEFAULT_DB_NAME = '11_life_resume';

function resolveDbName() {
  return String(process.env.DB_NAME || DEFAULT_DB_NAME).trim() || DEFAULT_DB_NAME;
}

function prepareSql(rawSql, dbName) {
  let sql = rawSql.replace(/`11_life_resume`/g, `\`${dbName}\``);
  if (process.env.MIGRATION_ASSUME_DB_EXISTS === '1') {
    sql = sql
      .replace(/CREATE DATABASE IF NOT EXISTS[^;]+;\s*/gi, '')
      .replace(/^\s*USE\s+`[^`]+`\s*;\s*/gim, '');
  }
  return sql;
}

function isAlreadyAppliedError(err) {
  return (
    err &&
    (err.code === 'ER_DUP_FIELDNAME' ||
      err.code === 'ER_DUP_KEYNAME' ||
      err.code === 'ER_TABLE_EXISTS_ERROR' ||
      err.errno === 1060 ||
      err.errno === 1061 ||
      err.errno === 1050)
  );
}

async function applyMigration(conn, file, dbName) {
  const filePath = path.join(__dirname, '../database/migrations', file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration not found: ${file}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const sql = prepareSql(raw, dbName);
  console.log(`[migrate] applying ${file} on ${dbName} ...`);
  try {
    await conn.query(sql);
    console.log(`[migrate] OK ${file}`);
  } catch (err) {
    if (isAlreadyAppliedError(err)) {
      console.log(`[migrate] SKIP ${file} (already applied)`);
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
