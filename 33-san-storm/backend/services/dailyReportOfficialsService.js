/**
 * 真三日报 · 势力高官 Lv1～Lv2 快照（32-6 §7）
 * 打开面板时实时查询，不写入 digest。
 */

const { pool } = require('../database/connection');
const { resolveFactionDisplayName } = require('./factionDisplayName');
const { SAN_1_PLAYABLE_FACTION_IDS } = require('../../shared/utils/san1PlayableFactions.cjs');

const SEASON = 'san_1';

/**
 * @returns {Promise<{ factions: Array<{ factionId: string, factionName: string|null, lv1: object[], lv2: object[] }> }>}
 */
async function listSan1OfficialsSnapshot() {
  const placeholders = SAN_1_PLAYABLE_FACTION_IDS.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT p.faction_id AS factionId,
            COALESCE(p.position_level, cp.position_level) AS positionLevel,
            COALESCE(NULLIF(TRIM(p.current_position_name), ''), cp.position_name) AS positionName,
            p.character_name AS characterName
     FROM players p
     INNER JOIN accounts a ON a.id = p.player_id AND a.status = 'active'
     LEFT JOIN config_positions cp ON cp.position_id = p.current_position_id AND cp.season = ?
     WHERE p.faction_id IN (${placeholders})
       AND p.player_id <> 'sys1'
       AND COALESCE(p.position_level, cp.position_level) IN (1, 2)
     ORDER BY p.faction_id,
              COALESCE(p.position_level, cp.position_level) ASC,
              COALESCE(cp.position_rank, 999999) ASC,
              p.character_name ASC`,
    [SEASON, ...SAN_1_PLAYABLE_FACTION_IDS],
  );

  /** @type {Record<string, { factionId: string, factionName: string|null, lv1: object[], lv2: object[] }>} */
  const byFaction = {};
  for (const factionId of SAN_1_PLAYABLE_FACTION_IDS) {
    byFaction[factionId] = { factionId, factionName: null, lv1: [], lv2: [] };
  }

  for (const row of rows || []) {
    const fid = row.factionId;
    if (!byFaction[fid]) continue;
    const entry = {
      positionName: row.positionName || '官职',
      characterName: row.characterName || '—',
    };
    const lvl = Number(row.positionLevel);
    if (lvl === 1) byFaction[fid].lv1.push(entry);
    else if (lvl === 2) byFaction[fid].lv2.push(entry);
  }

  await Promise.all(
    SAN_1_PLAYABLE_FACTION_IDS.map(async (factionId) => {
      byFaction[factionId].factionName = await resolveFactionDisplayName(factionId);
    }),
  );

  return {
    factions: SAN_1_PLAYABLE_FACTION_IDS.map((factionId) => byFaction[factionId]),
  };
}

module.exports = {
  listSan1OfficialsSnapshot,
};
