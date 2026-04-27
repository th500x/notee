/**
 * List accounting projects (local / any env using backend/.env).
 * Usage: node scripts/list-accounting-projects.js [--name=substring]
 */

const path = require('path');
const { createRequire } = require('module');

const backendRoot = path.join(__dirname, '..');
const requireBackend = createRequire(path.join(backendRoot, 'package.json'));

requireBackend('dotenv').config({ path: path.join(backendRoot, '.env') });
requireBackend('dotenv').config({ path: path.join(backendRoot, '.env.local'), override: true });
const mysql = requireBackend('mysql2/promise');

function parseNameArg() {
  const a = process.argv.find((x) => x.startsWith('--name='));
  return a ? a.slice('--name='.length) : null;
}

async function main() {
  const nameSub = parseNameArg();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '06_rental_tracking'
  });

  if (nameSub) {
    const like = `%${nameSub}%`;
    const [rows] = await conn.execute(
      `SELECT id, name, project_kind, visible, created_at
       FROM projects
       WHERE project_kind = 'accounting' AND name LIKE ?
       ORDER BY created_at DESC`,
      [like]
    );
    console.log(JSON.stringify(rows, null, 2));
  } else {
    const [rows] = await conn.execute(
      `SELECT id, name, project_kind, visible, created_at
       FROM projects
       WHERE project_kind = 'accounting'
       ORDER BY created_at DESC`
    );
    console.log(JSON.stringify(rows, null, 2));
  }
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
