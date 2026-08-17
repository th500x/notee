/**
 * Apply pending DDL migrations.
 * Usage: node scripts/apply-pending-local-ddl.js
 *
 * Production (宝塔已建空库):
 *   backend/.env 设 DB_*，并 MIGRATION_ASSUME_DB_EXISTS=1
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
  '001-phase0-bootstrap.sql',
  '002-users.sql',
  '003-posts.sql',
  '004-resonances.sql',
  '005-governance.sql',
  '006-monthly-board.sql',
  '007-posts-pour.sql',
  '008-posts-pour-quota.sql',
];

const DEFAULT_DB_NAME = '22_one_line';

function resolveDbName() {
  return String(process.env.DB_NAME || DEFAULT_DB_NAME).trim() || DEFAULT_DB_NAME;
}

function prepareSql(rawSql, dbName) {
  let sql = rawSql.replace(/`22_one_line`/g, `\`${dbName}\``);
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
      err.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
      err.errno === 1060 ||
      err.errno === 1061 ||
      err.errno === 1050 ||
      err.errno === 1091)
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
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';

  console.log(`[migrate] host=${host}:${port} user=${user} db=${dbName}`);

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  });

  try {
    for (const file of MIGRATION_FILES) {
      await applyMigration(conn, file, dbName);
    }
    console.log('[migrate] done');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[migrate] FAILED', err.message);
  process.exit(1);
});
