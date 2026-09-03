/**
 * 从 config_factions 读取势力玩法加成
 */

const { pool } = require('../database/connection');
const {
  getFactionTroopMaxTroopsBonus,
  getFactionDailyCheckinRewardsString,
  formatFactionCheckinBonusDisplayShort,
  formatCheckinExtraBonusesDisplayShort,
  parseFactionBonusesArray,
} = require('../../shared/utils/factionGameplayBonuses.cjs');
const {
  loadPositionSilverBonusForPlayer,
} = require('../../shared/utils/positionStipendBonuses.cjs');

/**
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} conn
 * @param {string|null|undefined} factionId
 * @returns {Promise<unknown>}
 */
async function loadFactionBonusesRaw(conn, factionId) {
  const fid = String(factionId || '').trim();
  if (!fid) return [];
  const db = conn || pool;
  const [rows] = await db.query(
    'SELECT faction_bonuses FROM config_factions WHERE faction_id = ? LIMIT 1',
    [fid],
  );
  return parseFactionBonusesArray(rows[0]?.faction_bonuses);
}

/**
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} conn
 * @param {string} playerId
 */
async function loadPlayerFactionBonusesRaw(conn, playerId) {
  const db = conn || pool;
  const [rows] = await db.query(
    'SELECT faction_id FROM players WHERE player_id = ? LIMIT 1',
    [playerId],
  );
  return loadFactionBonusesRaw(db, rows[0]?.faction_id);
}

/**
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} conn
 * @param {string} playerId
 * @returns {Promise<number>}
 */
async function getPlayerFactionTroopMaxTroopsBonus(conn, playerId) {
  const raw = await loadPlayerFactionBonusesRaw(conn, playerId);
  return getFactionTroopMaxTroopsBonus(raw);
}

/**
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} conn
 * @param {string|null|undefined} factionId
 * @param {Record<string, string>|null|undefined} [itemNameById]
 */
async function resolveFactionDailyCheckinBonus(conn, factionId, itemNameById) {
  const raw = await loadFactionBonusesRaw(conn, factionId);
  const rewards = getFactionDailyCheckinRewardsString(raw);
  if (!rewards) {
    return { rewards: null, displayShort: null };
  }
  return {
    rewards,
    displayShort: formatFactionCheckinBonusDisplayShort(rewards, itemNameById),
  };
}

/**
 * @param {import('mysql2').Pool|import('mysql2').PoolConnection} conn
 * @param {string} playerId
 * @param {string|null|undefined} factionId
 * @param {Record<string, string>|null|undefined} [itemNameById]
 */
async function resolveDailyCheckinExtraBonuses(conn, playerId, factionId, itemNameById) {
  const faction = await resolveFactionDailyCheckinBonus(conn, factionId, itemNameById);
  const positionSilver = await loadPositionSilverBonusForPlayer(conn, playerId);
  const displayShort = formatCheckinExtraBonusesDisplayShort({
    factionRewards: faction.rewards,
    positionSilver,
    itemNameById,
  });
  const rewardParts = [];
  if (faction.rewards) rewardParts.push(faction.rewards);
  if (positionSilver > 0) rewardParts.push(`silver:${positionSilver}`);
  return {
    rewards: rewardParts.length ? rewardParts.join(';') : null,
    displayShort,
    factionRewards: faction.rewards,
    positionSilver,
  };
}

module.exports = {
  loadFactionBonusesRaw,
  loadPlayerFactionBonusesRaw,
  getPlayerFactionTroopMaxTroopsBonus,
  resolveFactionDailyCheckinBonus,
  resolveDailyCheckinExtraBonuses,
};
