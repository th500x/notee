/**
 * 对当前库执行 migrations/drop-config-version-columns.sql（逐条 ALTER，忽略已删列）。
 * 用法（cwd = backend/）: node database/scripts/apply-drop-config-version-columns.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const SQL_PATH = path.join(__dirname, '../migrations/drop-config-version-columns.sql');

async function main() {
  const raw = fs.readFileSync(SQL_PATH, 'utf8');
  const stmts = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm',
    multipleStatements: false,
  });

  for (const sql of stmts) {
    try {
      await conn.query(sql);
      console.log('OK:', sql);
    } catch (e) {
      const msg = e.message || '';
      // MySQL 1091: Can't DROP 'version'; check that column/key exists
      // MySQL 1146 / ER_NO_SUCH_TABLE: table doesn't exist
      const skip =
        /Unknown table|doesn't exist|check that column\/key exists|check that column exists|Can't DROP/i.test(
          msg,
        ) ||
        e.code === 'ER_NO_SUCH_TABLE' ||
        e.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
        e.errno === 1146 ||
        e.errno === 1091;
      if (skip) {
        console.warn('SKIP:', sql, '→', msg);
      } else {
        throw e;
      }
    }
  }

  await conn.end();
  console.log('\n完成（SKIP 多为表未建或列已删）。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
