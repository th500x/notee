/**
 * 单独 apply 势力政策两张表（11-3 实装段1）：
 *   - create-faction-policies.sql
 *   - create-wars-pvp-policies.sql
 *
 * 用于在 `apply-pending-local-ddl.js` 因历史迁移问题中断时，单独把段1 表落库。
 * 与批跑脚本同一连接池配置（读 .env）；幂等 `CREATE TABLE IF NOT EXISTS`。
 *
 * 用法：
 *   node scripts/apply-faction-policy-tables.js
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../database/connection');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MIGRATIONS = [
  'create-faction-policies.sql',
  'create-wars-pvp-policies.sql',
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
  for (const file of MIGRATIONS) {
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
        e.code === 'ER_TABLE_EXISTS_ERROR' ||
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
