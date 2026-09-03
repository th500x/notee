/**
 * 执行单条迁移文件（多句 SQL 按分号拆分）。生产可只跑指定 DDL，不必跑全量批处理。
 * 用法（在 backend 目录）：node scripts/run-one-migration.js config-positions-drop-legacy-bonus-columns-json-type.sql
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../database/connection');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/run-one-migration.js <filename.sql>');
  process.exit(1);
}

const sql = fs
  .readFileSync(path.join(__dirname, '../database/migrations', file), 'utf8')
  .split('\n')
  .filter((line) => !/^\s*--/.test(line))
  .join('\n')
  .trim();

(async () => {
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
  console.log(`OK: ${file} (${statements.length} statements)`);
  await pool.end();
})().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
