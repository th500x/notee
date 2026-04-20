/**
 * 一次性执行 migrations/config-events-prune-san1-orphans-not-in-pipeline.sql（去注释整段）。
 * 用法（cwd backend）：node scripts/run-config-events-prune-san1.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function main() {
  const raw = fs.readFileSync(
    path.join(__dirname, '../database/migrations/config-events-prune-san1-orphans-not-in-pipeline.sql'),
    'utf8',
  );
  const sql = raw
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      return t && !t.startsWith('--');
    })
    .join('\n');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm',
    charset: 'utf8mb4',
  });
  try {
    const [res] = await conn.query(sql);
    const affected = res.affectedRows ?? res;
    console.log('DELETE affectedRows:', affected);
    const [[row]] = await conn.query(
      "SELECT COUNT(*) AS n FROM config_events WHERE season = 'san_1'",
    );
    console.log('config_events san_1 count after:', row.n);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
