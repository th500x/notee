/**
 * One-off: add cities.description (MariaDB / XAMPP). Safe if column exists.
 * Usage: node backend/database/scripts/run-add-cities-description.js (cwd = backend)
 */
const mysql = require('mysql2/promise');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const SQL = `
ALTER TABLE cities
  ADD COLUMN description TEXT NULL COMMENT 'from config_city_template.csv description' AFTER culture
`;

async function main() {
  const cfg = {
    host: process.env.DB_HOST || 'localhost',
    port: +(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm',
    charset: 'utf8mb4',
  };
  const c = await mysql.createConnection(cfg);
  try {
    await c.query(SQL);
    console.log('[run-add-cities-description] column added.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME' || String(e.message || '').includes('Duplicate column')) {
      console.log('[run-add-cities-description] column already exists, skip.');
    } else {
      console.error(e);
      process.exit(1);
    }
  } finally {
    await c.end();
  }
}

main();
