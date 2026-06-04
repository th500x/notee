/**
 * 修复易主后长官与势力不一致；中城/大城补设君主长官（与 applyCityOwnershipHandoff 对齐）。
 * node scripts/repair-city-lord-after-conquest.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../database/connection');
const { resolveFactionMonarchCharacterId } = require('../services/cityService');

async function setLordForCity(row, curFaction) {
  const [meta] = await pool.query(
    'SELECT city_type, season FROM cities WHERE city_id = ? LIMIT 1',
    [row.city_id],
  );
  const cityType = meta[0]?.city_type;
  const season = meta[0]?.season;
  const isMajorOrMedium = cityType === 'city_major' || cityType === 'city_medium';
  let monarch = null;
  if (isMajorOrMedium && curFaction) {
    monarch = await resolveFactionMonarchCharacterId(pool, curFaction, season);
  }
  await pool.query(
    `UPDATE cities SET lord_player_id = NULL,
       lord_appointed_at = CASE WHEN ? IS NOT NULL THEN NOW() ELSE NULL END,
       initial_lord_character_id = ?
     WHERE city_id = ?`,
    [monarch, monarch, row.city_id],
  );
}

(async () => {
  const seedPath = path.join(__dirname, '../../public/data/shared/cities_seed.json');
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const seedById = new Map((seed.cities || []).map((c) => [c.cityId, c]));

  const [rows] = await pool.query(
    `SELECT city_id, city_name, faction_id, lord_player_id, initial_lord_character_id, city_type
     FROM cities
     WHERE lord_player_id IS NOT NULL OR initial_lord_character_id IS NOT NULL`,
  );

  let fixed = 0;
  for (const row of rows) {
    const seedRow = seedById.get(row.city_id);
    const seedFaction = seedRow?.initialFactionId?.trim() || null;
    const curFaction = row.faction_id?.trim() || null;
    const conquered = seedFaction && curFaction && seedFaction !== curFaction;

    let lordMismatch = false;
    if (row.lord_player_id) {
      const [p] = await pool.query(
        'SELECT faction_id FROM players WHERE player_id = ? LIMIT 1',
        [row.lord_player_id],
      );
      if (p.length && p[0].faction_id !== curFaction) lordMismatch = true;
    }

    if (!conquered && !lordMismatch) continue;

    await setLordForCity(row, curFaction);
    console.log(`fixed: ${row.city_id} (${row.city_name})`);
    fixed += 1;
  }

  const [needMonarch] = await pool.query(
    `SELECT c.city_id, c.city_name, c.faction_id
     FROM cities c
     WHERE c.city_type IN ('city_major', 'city_medium')
       AND c.faction_id IS NOT NULL
       AND c.lord_player_id IS NULL
       AND c.initial_lord_character_id IS NULL`,
  );
  for (const row of needMonarch) {
    const seedRow = seedById.get(row.city_id);
    const seedFaction = seedRow?.initialFactionId?.trim() || null;
    const curFaction = row.faction_id?.trim() || null;
    if (!seedFaction || !curFaction || seedFaction === curFaction) continue;
    await setLordForCity(row, curFaction);
    console.log(`monarch: ${row.city_id} (${row.city_name})`);
    fixed += 1;
  }

  console.log(`done, fixed ${fixed} cities`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
