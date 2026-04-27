/**
 * Apply 002-add-accounting-sheet.sql using backend/.env
 *
 * Run: node backend/scripts/apply-accounting-sheet-migration.js
 *   or cd backend && npm run migrate:accounting
 */

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const backendRoot = path.join(__dirname, '..');
const requireBackend = createRequire(path.join(backendRoot, 'package.json'));

requireBackend('dotenv').config({ path: path.join(backendRoot, '.env') });
requireBackend('dotenv').config({ path: path.join(backendRoot, '.env.local'), override: true });
const mysql = requireBackend('mysql2/promise');

function stripLineComments(sql) {
  return sql
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (t.startsWith('--')) return '';
      return line;
    })
    .join('\n')
    .trim();
}

async function main() {
  const sqlPath = path.join(backendRoot, 'database/migrations/002-add-accounting-sheet.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Missing file:', sqlPath);
    process.exit(1);
  }

  let sql = fs.readFileSync(sqlPath, 'utf8');
  sql = stripLineComments(sql);
  if (!sql) {
    console.error('No SQL left after stripping comments.');
    process.exit(1);
  }

  const dbName = process.env.DB_NAME || '06_rental_tracking';

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName
  });

  try {
    await conn.query(sql);
    console.log('OK: accounting_sheet column applied.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
      console.log('SKIP: accounting_sheet already exists.');
      process.exit(0);
    }
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
