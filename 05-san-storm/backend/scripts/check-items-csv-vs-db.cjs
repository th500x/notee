/**
 * Compare item-template.csv vs public/data/shared/items.json vs MySQL config_items.
 * Run from 05-san-storm/backend: node scripts/check-items-csv-vs-db.cjs
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ROOT = path.join(__dirname, '../..');
const CSV_PATH = path.join(ROOT, 'docs/tools/item/item-template.csv');
const JSON_PATH = path.join(ROOT, 'public/data/shared/items.json');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function csvItemIds() {
  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const idx = headers.indexOf('item_id');
  if (idx < 0) throw new Error('item_id column missing');
  const ids = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const id = String(values[idx] || '').trim();
    if (id) ids.push(id);
  }
  return ids;
}

function jsonItemIds() {
  const doc = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const items = doc.items || [];
  return items.map((x) => x.id).filter(Boolean);
}

function setDiff(a, b) {
  const sb = new Set(b);
  return a.filter((x) => !sb.has(x));
}

async function main() {
  const csvIds = csvItemIds();
  const jsonIds = jsonItemIds();

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm',
    charset: 'utf8mb4',
  });

  const [rows] = await connection.query('SELECT item_id FROM config_items ORDER BY item_id');
  await connection.end();

  const dbIds = rows.map((r) => r.item_id);

  const csvSet = new Set(csvIds);
  const jsonSet = new Set(jsonIds);
  const dbSet = new Set(dbIds);

  const csvNotJson = csvIds.filter((id) => !jsonSet.has(id));
  const jsonNotCsv = jsonIds.filter((id) => !csvSet.has(id));

  const dbNotCsv = dbIds.filter((id) => !csvSet.has(id));
  const csvNotDb = csvIds.filter((id) => !dbSet.has(id));

  const dbNotJson = dbIds.filter((id) => !jsonSet.has(id));
  const jsonNotDb = jsonIds.filter((id) => !dbSet.has(id));

  console.log('--- counts ---');
  console.log('item-template.csv rows (non-empty item_id):', csvIds.length);
  console.log('items.json items:', jsonIds.length);
  console.log('config_items rows:', dbIds.length);

  console.log('\n--- CSV vs items.json (import reads JSON) ---');
  if (csvNotJson.length === 0 && jsonNotCsv.length === 0) {
    console.log('OK: same id set');
  } else {
    if (csvNotJson.length) console.log('in CSV only (missing from JSON):', csvNotJson);
    if (jsonNotCsv.length) console.log('in JSON only (stale vs CSV):', jsonNotCsv);
  }

  console.log('\n--- CSV vs DB ---');
  if (csvNotDb.length === 0 && dbNotCsv.length === 0) {
    console.log('OK: DB id set matches CSV');
  } else {
    if (csvNotDb.length) console.log('in CSV but NOT in DB (run import after item-csv-to-json):', csvNotDb);
    if (dbNotCsv.length) console.log('in DB but NOT in CSV (leftover / obsolete rows):', dbNotCsv);
  }

  console.log('\n--- items.json vs DB ---');
  if (jsonNotDb.length === 0 && dbNotJson.length === 0) {
    console.log('OK: DB matches items.json');
  } else {
    if (jsonNotDb.length) console.log('in JSON but NOT in DB:', jsonNotDb);
    if (dbNotJson.length) console.log('in DB but NOT in JSON:', dbNotJson);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
