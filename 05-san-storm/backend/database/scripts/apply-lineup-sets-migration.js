/**
 * One-shot: create player_lineup_sets, copy from player_garrison + player_lineup_extra,
 * archive/drop old tables.
 * Usage: node backend/database/scripts/apply-lineup-sets-migration.js
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function tableExists(c, name) {
  const [rows] = await c.query('SHOW TABLES LIKE ?', [name]);
  return rows.length > 0;
}

async function main() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm',
    multipleStatements: true,
  });

  const sqlPath = path.join(__dirname, '../migrations/create-player-lineup-sets.sql');
  await c.query(fs.readFileSync(sqlPath, 'utf8'));
  console.log('CREATE player_lineup_sets: OK');

  const [existingCount] = await c.query('SELECT COUNT(*) AS n FROM player_lineup_sets');
  const n = Number(existingCount[0]?.n || 0);

  if (n === 0) {
    if (await tableExists(c, 'player_garrison')) {
      await c.query(`
        INSERT INTO player_lineup_sets (
          player_id, lineup_scope, city_id, lineup_slot, city_name,
          char1_card, char1_equipment_card, char1_title, char1_achievement, char1_treasure, char1_troop1, char1_troop2,
          char2_card, char2_equipment_card, char2_title, char2_achievement, char2_treasure, char2_troop1, char2_troop2,
          is_active, created_at, updated_at
        )
        SELECT
          player_id, 'garrison', city_id, garrison_slot, city_name,
          char1_card, char1_equipment_card, char1_title, char1_achievement, char1_treasure, char1_troop1, char1_troop2,
          char2_card, char2_equipment_card, char2_title, char2_achievement, char2_treasure, char2_troop1, char2_troop2,
          COALESCE(is_active, FALSE), created_at, updated_at
        FROM player_garrison
      `);
      console.log('Copied player_garrison → player_lineup_sets (garrison)');
    }

    if (await tableExists(c, 'player_lineup_extra')) {
      await c.query(`
        INSERT INTO player_lineup_sets (
          player_id, lineup_scope, city_id, lineup_slot, city_name,
          char1_card, char1_equipment_card, char1_title, char1_achievement, char1_treasure, char1_troop1, char1_troop2,
          char2_card, char2_equipment_card, char2_title, char2_achievement, char2_treasure, char2_troop1, char2_troop2,
          is_active, created_at, updated_at
        )
        SELECT
          player_id, 'extra', '', lineup_slot, NULL,
          char1_card, char1_equipment_card, char1_title, char1_achievement, char1_treasure, char1_troop1, char1_troop2,
          char2_card, char2_equipment_card, char2_title, char2_achievement, char2_treasure, char2_troop1, char2_troop2,
          FALSE, created_at, updated_at
        FROM player_lineup_extra
      `);
      console.log('Copied player_lineup_extra → player_lineup_sets (extra)');
    }
  } else {
    console.log(`player_lineup_sets already has ${n} rows; skip copy`);
  }

  if (await tableExists(c, 'player_lineup_extra')) {
    await c.query('DROP TABLE player_lineup_extra');
    console.log('DROP player_lineup_extra: OK');
  }

  if (await tableExists(c, 'player_garrison')) {
    if (await tableExists(c, '_archive_player_garrison')) {
      await c.query('DROP TABLE _archive_player_garrison');
    }
    await c.query('RENAME TABLE player_garrison TO _archive_player_garrison');
    console.log('RENAME player_garrison → _archive_player_garrison: OK');
  }

  const [verify] = await c.query('SHOW TABLES LIKE ?', ['player_lineup_sets']);
  const [counts] = await c.query(
    `SELECT lineup_scope, COUNT(*) AS n FROM player_lineup_sets GROUP BY lineup_scope`,
  );
  console.log('player_lineup_sets:', verify.length ? 'OK' : 'MISSING', counts);
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
