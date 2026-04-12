/**
 * 按顺序执行指定迁移文件（本地库）。列已存在则跳过。
 * node scripts/apply-pending-local-ddl.js
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../database/connection');

const MIGRATION_FILES = [
  'add-players-on-duty-city-id.sql',
  'add-players-main-city-id.sql',
  'add-players-main-city-changed-at.sql',
  'add-config-servers-game-time.sql',
  'create-chats-table.sql',
  'add-veteran-columns.sql',
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
      await pool.query(sql);
      console.log(`OK: ${file}`);
    } catch (e) {
      if (
        e.code === 'ER_DUP_FIELDNAME' ||
        e.code === 'ER_TABLE_EXISTS_ERROR' ||
        /Duplicate column name/i.test(e.message || '') ||
        /already exists/i.test(e.message || '')
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
