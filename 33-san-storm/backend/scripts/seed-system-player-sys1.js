/**
 * 本地补种 sys1 系统占位账号（texts.sender_id 外键）
 * node scripts/seed-system-player-sys1.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../database/migrations/seed-system-player-sys1.sql'),
    'utf8',
  );
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
    const [r] = await conn.query(`SELECT player_id, character_name FROM players WHERE player_id='sys1'`);
    console.log('OK seed-system-player-sys1', r[0] || null);
  } finally {
    await conn.end();
  }
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
