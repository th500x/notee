/**
 * One-shot patcher: rewrite player_garrison SQL → player_lineup_sets in backend services.
 * Run from backend/: node database/scripts/patch-lineup-sets-sql.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');

function patchGarrisonService() {
  const file = path.join(root, 'services/garrisonService.js');
  let s = fs.readFileSync(file, 'utf8');

  if (!s.includes("require('../constants/lineupSets')")) {
    s = s.replace(
      "const { pool } = require('../database/connection');",
      "const { pool } = require('../database/connection');\n"
        + "const { mapGarrisonApiRow, mapGarrisonApiRows } = require('../constants/lineupSets');",
    );
  }

  s = s.replaceAll(
    'DELETE FROM player_garrison WHERE player_id = ? AND city_id = ?',
    "DELETE FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ?",
  );
  s = s.replaceAll(
    'UPDATE player_garrison SET city_id = ? WHERE player_id = ? AND city_id = ?',
    "UPDATE player_lineup_sets SET city_id = ? WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ?",
  );
  s = s.replaceAll(
    'DELETE FROM player_garrison WHERE player_id = ? AND city_id <> ?',
    "DELETE FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id <> ?",
  );
  s = s.replaceAll(
    "'SELECT * FROM player_garrison WHERE player_id = ? ORDER BY city_id, garrison_slot'",
    "\"SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' ORDER BY city_id, lineup_slot\"",
  );
  s = s.replaceAll(
    "'SELECT * FROM player_garrison WHERE player_id = ? AND city_id = ? ORDER BY garrison_slot'",
    "\"SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ? ORDER BY lineup_slot\"",
  );
  s = s.replaceAll(
    "'SELECT * FROM player_garrison WHERE player_id = ? AND city_id = ? AND garrison_slot = ?'",
    "\"SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ? AND lineup_slot = ?\"",
  );
  s = s.replaceAll(
    "'SELECT * FROM player_garrison WHERE player_id = ?'",
    "\"SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison'\"",
  );
  s = s.replaceAll('FROM player_garrison g', 'FROM player_lineup_sets g');
  s = s.replaceAll('DELETE g FROM player_garrison g', 'DELETE g FROM player_lineup_sets g');
  s = s.replaceAll('g.garrison_slot', 'g.lineup_slot');

  // conflict query: g.garrison_slot already → lineup_slot; add scope + fix NOT clause
  s = s.replaceAll(
    `SELECT g.lineup_slot, g.city_id, pc.instance_id
       FROM player_lineup_sets g
       JOIN player_cards pc ON pc.instance_id IN (\${placeholders})
       WHERE g.player_id = ? AND g.is_active = TRUE
         AND NOT (g.city_id <=> ? AND g.lineup_slot = ?)`,
    `SELECT g.lineup_slot, g.city_id, pc.instance_id
       FROM player_lineup_sets g
       JOIN player_cards pc ON pc.instance_id IN (\${placeholders})
       WHERE g.player_id = ? AND g.lineup_scope = 'garrison' AND g.is_active = TRUE
         AND NOT (g.city_id <=> ? AND g.lineup_slot = ?)`,
  );

  // INSERT
  s = s.replace(
    `INSERT INTO player_garrison (
      player_id, garrison_slot, city_id, city_name,`,
    `INSERT INTO player_lineup_sets (
      player_id, lineup_scope, city_id, lineup_slot, city_name,`,
  );
  s = s.replace(
    `) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      city_id = VALUES(city_id), city_name = VALUES(city_name),`,
    `) VALUES (?, 'garrison', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      city_name = VALUES(city_name),`,
  );
  s = s.replace(
    `playerId, slotNumber, mergedWithPrev.cityId || null, mergedWithPrev.cityName || null,`,
    `playerId, mergedWithPrev.cityId || null, slotNumber, mergedWithPrev.cityName || null,`,
  );

  s = s.replace(
    `UPDATE player_garrison SET \${nullSets}, is_active = FALSE
     WHERE player_id = ? AND city_id = ? AND garrison_slot = ?`,
    `UPDATE player_lineup_sets SET \${nullSets}, is_active = FALSE
     WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ? AND lineup_slot = ?`,
  );

  // city defender queries: add scope filter
  s = s.replaceAll(
    'WHERE g.city_id = ? AND g.is_active = TRUE',
    "WHERE g.lineup_scope = 'garrison' AND g.city_id = ? AND g.is_active = TRUE",
  );
  s = s.replaceAll(
    'WHERE g.is_active = TRUE AND g.city_id IS NOT NULL',
    "WHERE g.lineup_scope = 'garrison' AND g.is_active = TRUE AND g.city_id IS NOT NULL AND g.city_id <> ''",
  );
  // strip conquest join already has FROM player_lineup_sets; add scope
  s = s.replaceAll(
    'WHERE g.city_id = ? AND p.faction_id != ?',
    "WHERE g.lineup_scope = 'garrison' AND g.city_id = ? AND p.faction_id != ?",
  );

  // map API rows on getters
  s = s.replace(
    `async function getPlayerGarrisons(playerId) {
  const [rows] = await pool.query(
    "SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' ORDER BY city_id, lineup_slot",
    [playerId]
  );
  return rows;
}`,
    `async function getPlayerGarrisons(playerId) {
  const [rows] = await pool.query(
    "SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' ORDER BY city_id, lineup_slot",
    [playerId]
  );
  return mapGarrisonApiRows(rows);
}`,
  );

  s = s.replace(
    `async function getPlayerGarrisonsForCity(playerId, cityId) {
  if (!cityId) return [];
  const [rows] = await pool.query(
    "SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ? ORDER BY lineup_slot",
    [playerId, cityId]
  );
  return rows;
}`,
    `async function getPlayerGarrisonsForCity(playerId, cityId) {
  if (!cityId) return [];
  const [rows] = await pool.query(
    "SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ? ORDER BY lineup_slot",
    [playerId, cityId]
  );
  return mapGarrisonApiRows(rows);
}`,
  );

  s = s.replace(
    `  const [rows] = await pool.query(
    "SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ? AND lineup_slot = ?",
    [playerId, cityId, slotNumber]
  );
  return rows[0] || null;
}`,
    `  const [rows] = await pool.query(
    "SELECT * FROM player_lineup_sets WHERE player_id = ? AND lineup_scope = 'garrison' AND city_id = ? AND lineup_slot = ?",
    [playerId, cityId, slotNumber]
  );
  return mapGarrisonApiRow(rows[0] || null);
}`,
  );

  // map defender list rows
  s = s.replace(
    `  const [rows] = await pool.query(sql, params);
  return filterCityDefenseRowsByMinStationedTroop(rows);
}

/**
 * 披挂上阵待战本城的玩家（与 \`player_garrison\` 无直接关系；战力来自上阵编组）。`,
    `  const [rows] = await pool.query(sql, params);
  return filterCityDefenseRowsByMinStationedTroop(mapGarrisonApiRows(rows));
}

/**
 * 披挂上阵待战本城的玩家（与 \`player_garrison\` 无直接关系；战力来自上阵编组）。`,
  );

  // getCityGarrisonDefenders return
  s = s.replace(
    `  sql += ' ORDER BY p.position_level ASC, g.lineup_slot ASC';
  const [rows] = await pool.query(sql, params);
  return filterCityDefenseRowsByMinStationedTroop(rows);
}

/**
 * 城市驻地统计（大地图城备 tooltip \`GET /api/garrisons/stats/cities\`）。`,
    `  sql += ' ORDER BY p.position_level ASC, g.lineup_slot ASC';
  const [rows] = await pool.query(sql, params);
  return filterCityDefenseRowsByMinStationedTroop(mapGarrisonApiRows(rows));
}

/**
 * 城市驻地统计（大地图城备 tooltip \`GET /api/garrisons/stats/cities\`）。`,
  );

  // getCityGarrisonStats
  s = s.replace(
    'effective = await filterCityDefenseRowsByMinStationedTroop(allSlots);',
    'effective = await filterCityDefenseRowsByMinStationedTroop(mapGarrisonApiRows(allSlots));',
  );

  fs.writeFileSync(file, s);
  const left = (s.match(/FROM player_garrison|INTO player_garrison|UPDATE player_garrison|DELETE FROM player_garrison|DELETE g FROM player_garrison/g) || []).length;
  console.log('garrisonService left table refs:', left);
}

function patchFile(rel, replacements) {
  const file = path.join(root, rel);
  let s = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacements) {
    if (!s.includes(from)) {
      console.warn('WARN missing pattern in', rel, ':', from.slice(0, 80));
      continue;
    }
    s = s.split(from).join(to);
  }
  fs.writeFileSync(file, s);
  console.log('patched', rel);
}

patchGarrisonService();

patchFile('services/pvpWarService.js', [
  [
    "'SELECT DISTINCT player_id FROM player_garrison WHERE city_id = ?'",
    "\"SELECT DISTINCT player_id FROM player_lineup_sets WHERE lineup_scope = 'garrison' AND city_id = ?\"",
  ],
  [
    "'SELECT * FROM player_garrison WHERE player_id = ? AND city_id = ? AND garrison_slot = ? LIMIT 1'",
    "\"SELECT * FROM player_lineup_sets WHERE lineup_scope = 'garrison' AND player_id = ? AND city_id = ? AND lineup_slot = ? LIMIT 1\"",
  ],
  [
    "'SELECT char1_troop1, char1_troop2, char2_troop1, char2_troop2 FROM player_garrison WHERE player_id = ? AND city_id = ? AND garrison_slot = ?'",
    "\"SELECT char1_troop1, char1_troop2, char2_troop1, char2_troop2 FROM player_lineup_sets WHERE lineup_scope = 'garrison' AND player_id = ? AND city_id = ? AND lineup_slot = ?\"",
  ],
  [
    "'UPDATE player_garrison SET is_active = FALSE WHERE player_id = ? AND city_id = ? AND garrison_slot = ?'",
    "\"UPDATE player_lineup_sets SET is_active = FALSE WHERE lineup_scope = 'garrison' AND player_id = ? AND city_id = ? AND lineup_slot = ?\"",
  ],
]);

patchFile('services/treasureUseService.js', [
  [
    'UPDATE player_garrison SET ${sets} WHERE player_id = ?',
    "UPDATE player_lineup_sets SET ${sets} WHERE player_id = ?",
  ],
  [
    `UPDATE player_garrison g
     LEFT JOIN player_cards pc1 ON pc1.instance_id = g.char1_treasure AND pc1.player_id = g.player_id`,
    `UPDATE player_lineup_sets g
     LEFT JOIN player_cards pc1 ON pc1.instance_id = g.char1_treasure AND pc1.player_id = g.player_id`,
  ],
  [
    'FROM player_garrison WHERE player_id = ?',
    'FROM player_lineup_sets WHERE player_id = ?',
  ],
]);

patchFile('services/battleTreasureAllyService.js', [
  [
    `SELECT char1_treasure, char2_treasure FROM player_garrison
     WHERE player_id = ? AND city_id = ? AND garrison_slot = ? LIMIT 1`,
    `SELECT char1_treasure, char2_treasure FROM player_lineup_sets
     WHERE lineup_scope = 'garrison' AND player_id = ? AND city_id = ? AND lineup_slot = ? LIMIT 1`,
  ],
]);

patchFile('services/cityService.js', [
  [
    'SELECT DISTINCT g.player_id FROM player_garrison g WHERE g.city_id = ?',
    "SELECT DISTINCT g.player_id FROM player_lineup_sets g WHERE g.lineup_scope = 'garrison' AND g.city_id = ?",
  ],
]);

patchFile('services/pvpService.js', [
  [
    `FROM player_garrison g
     JOIN players p ON g.player_id = p.player_id
     JOIN accounts a ON g.player_id = a.id
     JOIN cities c ON c.city_id = g.city_id
     WHERE g.city_id = ? AND g.is_active = TRUE
       AND g.player_id != ? AND p.faction_id != ?
       AND c.faction_id IS NOT NULL AND p.faction_id = c.faction_id
     ORDER BY p.position_level ASC, g.garrison_slot ASC`,
    `FROM player_lineup_sets g
     JOIN players p ON g.player_id = p.player_id
     JOIN accounts a ON g.player_id = a.id
     JOIN cities c ON c.city_id = g.city_id
     WHERE g.lineup_scope = 'garrison' AND g.city_id = ? AND g.is_active = TRUE
       AND g.player_id != ? AND p.faction_id != ?
       AND c.faction_id IS NOT NULL AND p.faction_id = c.faction_id
     ORDER BY p.position_level ASC, g.lineup_slot ASC`,
  ],
]);

patchFile('services/troopDurabilityService.js', [
  [
    'UPDATE player_garrison g',
    'UPDATE player_lineup_sets g',
  ],
  [
    `UPDATE player_garrison
     SET is_active = (
       (char1_card IS NOT NULL OR char2_card IS NOT NULL)
       AND (char1_troop1 IS NOT NULL OR char1_troop2 IS NOT NULL OR char2_troop1 IS NOT NULL OR char2_troop2 IS NOT NULL)
     )
     WHERE player_id = ?`,
    `UPDATE player_lineup_sets
     SET is_active = (
       (char1_card IS NOT NULL OR char2_card IS NOT NULL)
       AND (char1_troop1 IS NOT NULL OR char1_troop2 IS NOT NULL OR char2_troop1 IS NOT NULL OR char2_troop2 IS NOT NULL)
     )
     WHERE player_id = ? AND lineup_scope = 'garrison'`,
  ],
]);

patchFile('services/accountService.js', [
  ["'player_garrison'", "'player_lineup_sets'"],
]);

console.log('done');
