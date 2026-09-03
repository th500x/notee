/**
 * 本地一次性：整图重随城属性，并按人口×1%重掷 NPC 守军（验证用）
 * node scripts/reseed-city-attributes-once.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { pool } = require('../database/connection');
const { reseedAllCityAttributes } = require('../services/cityAttributeGrowthService');
const {
  resolveNpcGarrisonCapFromPopulation,
} = require('../../shared/utils/cityInitialAttributes.cjs');

(async () => {
  try {
    const result = await reseedAllCityAttributes();
    console.log('reseed:', JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
      return;
    }

    const [sample] = await pool.query(
      `SELECT city_id, city_type, city_name, population, trading, farming, military, culture,
              defense, final_trading, final_farming, status, npc_garrison_alive,
              (faction_id IS NOT NULL AND TRIM(faction_id) <> '') AS has_faction
       FROM cities
       ORDER BY FIELD(city_type, 'city_major', 'city_medium', 'city_small', 'city_gate'), city_id
       LIMIT 24`,
    );
    console.log('\n--- sample (24) ---');
    console.table(
      sample.map((r) => ({
        ...r,
        npc_cap_expected: resolveNpcGarrisonCapFromPopulation(r.population),
      })),
    );

    const [stats] = await pool.query(
      `SELECT city_type,
              COUNT(*) AS n,
              MIN(population) AS pop_min,
              MAX(population) AS pop_max,
              MIN(npc_garrison_alive) AS npc_min,
              MAX(npc_garrison_alive) AS npc_max,
              MIN(trading) AS tr_min,
              MAX(trading) AS tr_max,
              MIN(defense) AS def_min,
              MAX(defense) AS def_max
       FROM cities
       GROUP BY city_type
       ORDER BY FIELD(city_type, 'city_major', 'city_medium', 'city_small', 'city_gate')`,
    );
    console.log('\n--- by type ---');
    console.table(stats);

    const [gates] = await pool.query(
      `SELECT city_id, trading, farming, military, culture
       FROM cities
       WHERE city_type = 'city_gate'
         AND (trading <> 0 OR farming <> 0 OR military <> 0 OR culture <> 0)
       LIMIT 5`,
    );
    if (gates.length) {
      console.error('FAIL: gate dims not zero', gates);
      process.exitCode = 1;
    } else {
      console.log('\nOK: all city_gate trading/farming/military/culture = 0');
    }

    const [npcMismatch] = await pool.query(
      `SELECT city_id, city_name, population, npc_garrison_alive,
              JSON_LENGTH(JSON_EXTRACT(npc_garrison, '$.units')) AS slot_count
       FROM cities
       WHERE npc_garrison IS NULL
          OR npc_garrison_alive IS NULL
          OR JSON_LENGTH(JSON_EXTRACT(npc_garrison, '$.units')) IS NULL
          OR JSON_LENGTH(JSON_EXTRACT(npc_garrison, '$.units')) <> npc_garrison_alive
       LIMIT 10`,
    );
    // 满编时 alive == slot；reseed 后应为满编。另验 slot ≈ round(pop*0.01)
    const [npcCapBad] = await pool.query(
      `SELECT city_id, city_name, population,
              JSON_LENGTH(JSON_EXTRACT(npc_garrison, '$.units')) AS slot_count
       FROM cities
       WHERE npc_garrison IS NULL
          OR ABS(
               JSON_LENGTH(JSON_EXTRACT(npc_garrison, '$.units'))
               - GREATEST(1, LEAST(2000, ROUND(population * 0.01)))
             ) > 0
       LIMIT 10`,
    );
    if (npcMismatch.length || npcCapBad.length) {
      console.error('FAIL: NPC roster not aligned after reseed', {
        npcMismatch,
        npcCapBad,
      });
      process.exitCode = 1;
    } else {
      console.log('\nOK: all cities NPC slots = round(population × 1%) and full alive');
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
