/**
 * One-shot: apply player_lineup_extra migration.
 * Usage: node backend/database/scripts/apply-lineup-extra-migration.js
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function main() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm',
    multipleStatements: true,
  });
  const sqlPath = path.join(__dirname, '../migrations/create-player-lineup-extra.sql');
  await c.query(fs.readFileSync(sqlPath, 'utf8'));
  const [cols] = await c.query('SHOW TABLES LIKE ?', ['player_lineup_extra']);
  console.log('player_lineup_extra:', cols.length ? 'OK' : 'MISSING');
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
