/**
 * Run database/reset-local-unified-06.sql (XAMPP / local only).
 * Drops rental_tracking and 06_rental_tracking, recreates 06_rental_tracking + projects.
 *
 *   node backend/scripts/reset-local-unified-06.js --yes
 */

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

if (!process.argv.includes('--yes')) {
  console.error('Refusing to run without --yes (this deletes local databases).');
  console.error('Usage: node backend/scripts/reset-local-unified-06.js --yes');
  process.exit(1);
}

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
  const sqlPath = path.join(backendRoot, 'database/reset-local-unified-06.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Missing:', sqlPath);
    process.exit(1);
  }

  let sql = stripLineComments(fs.readFileSync(sqlPath, 'utf8'));
  if (!sql) {
    console.error('Empty SQL after strip.');
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    await conn.query(sql);
    console.log('OK: local DB unified to 06_rental_tracking (see backend/.env DB_NAME=06_rental_tracking).');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
