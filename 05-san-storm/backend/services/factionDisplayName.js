/**
 * 势力展示名：公告/战事文案优先 `config_factions.faction_name`，避免 `factions.faction_name` 种子占位串。
 */

const { pool } = require('../database/connection');

const PLACEHOLDER_NAME_RE = /seed\s*placeholder/i;

/**
 * @param {string|null|undefined} name
 * @returns {boolean}
 */
function isPlaceholderFactionName(name) {
  return PLACEHOLDER_NAME_RE.test(String(name || '').trim());
}

/**
 * @param {string} factionId
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} [queryable]
 * @returns {Promise<string|null>}
 */
async function resolveFactionDisplayName(factionId, queryable = pool) {
  const fid = String(factionId || '').trim();
  if (!fid) return null;
  const [rows] = await queryable.query(
    `SELECT f.faction_name AS runtime_name, cf.faction_name AS config_name
     FROM factions f
     LEFT JOIN config_factions cf ON cf.faction_id = f.id AND cf.season = f.season
     WHERE f.id = ?
     LIMIT 1`,
    [fid],
  );
  if (!rows.length) return null;
  const configName = String(rows[0].config_name || '').trim();
  const runtimeName = String(rows[0].runtime_name || '').trim();
  if (configName && !isPlaceholderFactionName(configName)) return configName;
  if (runtimeName && !isPlaceholderFactionName(runtimeName)) return runtimeName;
  return configName || runtimeName || null;
}

module.exports = {
  isPlaceholderFactionName,
  resolveFactionDisplayName,
};
