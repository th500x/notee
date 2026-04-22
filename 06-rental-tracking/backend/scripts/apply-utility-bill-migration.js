/**
 * Apply 001-add-project-kind-utility-sheet.sql using backend/.env
 *
 * Run from 06-rental-tracking root OR from backend (either works):
 *   node backend/scripts/apply-utility-bill-migration.js
 *   cd backend && node scripts/apply-utility-bill-migration.js
 *
 * Resolves dotenv / mysql2 from backend/node_modules (not cwd).
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
  const nm = path.join(backendRoot, 'node_modules');
  if (!fs.existsSync(nm)) {
    console.error('Missing backend/node_modules. Run: cd backend && npm install');
    process.exit(1);
  }

  const sqlPath = path.join(backendRoot, 'database/migrations/001-add-project-kind-utility-sheet.sql');
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

  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: dbName
    });
  } catch (err) {
    if (err.code === 'ER_BAD_DB_ERROR' || err.errno === 1049) {
      console.error('数据库不存在:', dbName);
      console.error('');
      console.error('库名来自 backend/.env 的 DB_NAME；未配置时默认 06_rental_tracking。');
      console.error('可执行 backend/init-database.sql，或本地一键：npm run db:reset-local（需先 cd backend）');
      console.error('然后设 backend/.env 中 DB_NAME=06_rental_tracking。');
      console.error('');
      process.exit(1);
    }
    throw err;
  }

  try {
    await conn.query(sql);
    console.log('OK: migration applied (project_kind + utility_sheet).');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
      console.log('SKIP: column(s) already exist, nothing to do.');
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
