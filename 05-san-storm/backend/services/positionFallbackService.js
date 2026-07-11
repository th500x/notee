/**
 * 官职回退：按当前声望解析势力内可担任的最高官职（不记忆原职）
 * @see docs/01-jun-exploration/40-ai/41-1-AI_KING_SYSTEM.md §前任卸职
 */

const fs = require('fs');
const path = require('path');
const { grantPositionOnConnection } = require('./rewardService');
const { autoRerollAttributesForRarity } = require('./playerRerollService');
const { getRerollRarityForPlayer } = require('../../shared/utils/positionRerollRarity.cjs');

const DEFAULT_FALLBACK_POSITION_ID = 'san_1_position_junhou';
/** Lv.1～4 势力唯一席位（与 12-1 一致） */
const UNIQUE_SEAT_MAX_LEVEL = 4;

let nonPromotableIdsCache = null;

function getNonPromotablePositionIds() {
  if (nonPromotableIdsCache) return nonPromotableIdsCache;
  nonPromotableIdsCache = new Set();
  try {
    const fp = path.join(__dirname, '../../public/data/shared/positions.json');
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    for (const p of j.positions || []) {
      const req = String(p.requirement || '').trim().toUpperCase();
      if (req === 'AI' || req === 'KING_DAILY') {
        nonPromotableIdsCache.add(p.id);
      }
    }
  } catch (e) {
    console.warn('[positionFallbackService] positions.json:', e.message);
  }
  return nonPromotableIdsCache;
}

function parseSeasonFromFactionId(factionId) {
  if (!factionId || typeof factionId !== 'string') return 'san_1';
  const parts = factionId.split('_');
  return parts.length >= 2 ? `${parts[0]}_${parts[1]}` : 'san_1';
}

/**
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {{ playerId: string, factionId: string, season?: string, excludePositionIds?: string[] }} opts
 * @returns {Promise<string>} config_positions.position_id
 */
async function resolveHighestPositionByReputation(connection, opts) {
  const playerId = String(opts.playerId || '').trim();
  const factionId = String(opts.factionId || '').trim();
  const season = opts.season || parseSeasonFromFactionId(factionId);
  const exclude = new Set([...(opts.excludePositionIds || []), ...getNonPromotablePositionIds()]);

  const [pRows] = await connection.query(
    'SELECT reputation FROM players WHERE player_id = ? LIMIT 1',
    [playerId],
  );
  const rep = Number(pRows[0]?.reputation) || 0;

  const [posList] = await connection.query(
    `SELECT position_id, position_level, position_rank, requirement
     FROM config_positions
     WHERE season = ? AND requirement > 0 AND requirement <= ?
     ORDER BY position_level ASC, position_rank ASC`,
    [season, rep],
  );

  for (const row of posList || []) {
    if (exclude.has(row.position_id)) continue;
    if (Number(row.position_level) <= UNIQUE_SEAT_MAX_LEVEL) {
      const [holders] = await connection.query(
        `SELECT player_id FROM players
         WHERE faction_id = ? AND current_position_id = ? AND player_id <> ? LIMIT 1`,
        [factionId, row.position_id, playerId],
      );
      if (holders.length > 0) continue;
    }
    return row.position_id;
  }

  return DEFAULT_FALLBACK_POSITION_ID;
}

/**
 * 若玩家当前担任大司空，则按声望回退至最高可任官职
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {{ playerId: string, factionId: string, dasikongPositionId: string }} opts
 */
async function demoteIfHoldingDasikong(connection, opts) {
  const playerId = String(opts.playerId || '').trim();
  const factionId = String(opts.factionId || '').trim();
  const dasikongId = String(opts.dasikongPositionId || '').trim();

  const [rows] = await connection.query(
    'SELECT current_position_id FROM players WHERE player_id = ? LIMIT 1',
    [playerId],
  );
  if (rows[0]?.current_position_id !== dasikongId) {
    return { changed: false };
  }

  const newPosId = await resolveHighestPositionByReputation(connection, {
    playerId,
    factionId,
    excludePositionIds: [dasikongId],
  });
  const grant = await grantPositionOnConnection(connection, playerId, newPosId);
  if (!grant.ok) {
    throw new Error(grant.error || '官职回退失败');
  }
  const fallbackRarity = getRerollRarityForPlayer({
    positionLevel: grant.detail.positionLevel,
    currentPositionId: newPosId,
  });
  const reroll = await autoRerollAttributesForRarity(connection, playerId, fallbackRarity);
  return {
    changed: true,
    detail: grant.detail,
    reroll,
    previousPositionId: dasikongId,
  };
}

module.exports = {
  resolveHighestPositionByReputation,
  demoteIfHoldingDasikong,
  parseSeasonFromFactionId,
  getNonPromotablePositionIds,
};
