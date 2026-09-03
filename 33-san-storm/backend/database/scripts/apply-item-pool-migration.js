/**
 * One-shot: apply item-pool migration + verify.
 * Usage: node backend/database/scripts/apply-item-pool-migration.js
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
  const sqlPath = path.join(__dirname, '../migrations/add-item-pool-and-chapter-tactical.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  try {
    await c.query(sql);
    console.log('migration OK');
  } catch (e) {
    console.log('migration:', e.message);
  }
  const [cols] = await c.query("SHOW COLUMNS FROM config_items LIKE 'item_type'");
  console.log('item_type', cols[0]?.Type);
  const [poolCols] = await c.query("SHOW COLUMNS FROM temp_card_pool_draws LIKE 'pool_type'");
  console.log('pool_type', poolCols[0]?.Type);
  const [items] = await c.query(
    "SELECT item_id, item_type FROM config_items WHERE item_id IN ('item_token','item_jade','item_season_token','item_season_badge')",
  );
  console.log('items', items);
  const [tr] = await c.query('SELECT treasure_id FROM config_treasures ORDER BY treasure_id');
  console.log(
    'treasures',
    tr.map((r) => r.treasure_id),
  );
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
