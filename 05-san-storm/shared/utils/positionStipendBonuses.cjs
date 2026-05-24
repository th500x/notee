/**
 * 官职 · 俸禄向加成（声望/贡献：每日固定整数；资源：俸禄银粮 ×倍数）。
 * 消费方：`backend/services/sanGongStipendService.js`。
 */

'use strict';

/**
 * @param {object|string|null|undefined} raw
 * @returns {object}
 */
function parsePositionBonusesRaw(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

/**
 * @param {object|string|null|undefined} raw DB JSON 或 API camelCase position_bonuses
 * @returns {{ reputationGrant: number, contributionGrant: number, resourceMultiplier: number }}
 */
function normalizePositionStipendBonuses(raw) {
  const b = parsePositionBonusesRaw(raw);
  const rep = Number(b.reputation ?? b.reputationBonus ?? 0) || 0;
  const contrib = Number(b.contribution ?? b.contributionBonus ?? 0) || 0;
  const res = Number(b.resource ?? b.resourceBonus ?? 0) || 0;

  const reputationGrant = rep >= 1 ? Math.floor(rep) : 0;
  const contributionGrant = contrib >= 1 ? Math.floor(contrib) : 0;
  const resourceMultiplier = res >= 1 ? res : 1;

  return { reputationGrant, contributionGrant, resourceMultiplier };
}

/**
 * @param {number} baseSilver
 * @param {number} baseFood
 * @param {number} resourceMultiplier
 * @returns {{ silver: number, food: number }}
 */
function applyStipendResourceMultiplier(baseSilver, baseFood, resourceMultiplier) {
  const m = Number(resourceMultiplier) || 1;
  if (m <= 0 || m === 1) {
    return { silver: baseSilver, food: baseFood };
  }
  return {
    silver: Math.floor(baseSilver * m),
    food: Math.floor(baseFood * m),
  };
}

/**
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} poolConn
 * @param {string} playerId
 * @returns {Promise<{ reputationGrant: number, contributionGrant: number, resourceMultiplier: number }>}
 */
async function loadPositionStipendBonusesForPlayer(poolConn, playerId) {
  if (!playerId) {
    return { reputationGrant: 0, contributionGrant: 0, resourceMultiplier: 1 };
  }
  const [rows] = await poolConn.query(
    `SELECT cp.position_bonuses
     FROM players p
     LEFT JOIN config_positions cp ON cp.position_id = p.current_position_id
     WHERE p.player_id = ?
     LIMIT 1`,
    [playerId],
  );
  if (!rows.length) {
    return { reputationGrant: 0, contributionGrant: 0, resourceMultiplier: 1 };
  }
  return normalizePositionStipendBonuses(rows[0].position_bonuses);
}

module.exports = {
  normalizePositionStipendBonuses,
  applyStipendResourceMultiplier,
  loadPositionStipendBonusesForPlayer,
};
