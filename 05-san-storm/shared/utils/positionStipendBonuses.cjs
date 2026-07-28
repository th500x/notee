/**
 * 官职 · 签到银两加成（position_bonuses.silver / silverBonus）。
 * 真三日报签到发放；俸禄不再叠加官职声望/贡献/资源倍数。
 *
 * `silverBonusQuotaUnits`（floor(silverBonus/10)）供：真三日报战事公议投票权、
 * 君主日俸附赠 `item_tactic_token` 等共用。
 *
 * 银粮兑换基数仍可复用 applyStipendResourceMultiplier（倍数恒为 1 时等价于原样）。
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
 * @returns {number} 每日签到额外银两（整数，≥0）
 */
function getPositionSilverBonus(raw) {
  const b = parsePositionBonusesRaw(raw);
  const n = Math.floor(Number(b.silver ?? b.silverBonus ?? 0) || 0);
  return n > 0 ? n : 0;
}

/**
 * 官职银两加成折算配额单位：`floor(silverBonus / 10)`（≥0）。
 * 与真三日报投票权重、日俸兵符数量同源。
 * @param {number|null|undefined} silverBonus
 * @returns {number}
 */
function silverBonusQuotaUnits(silverBonus) {
  return Math.max(0, Math.floor((Number(silverBonus) || 0) / 10));
}

/**
 * @deprecated 俸禄已不再读官职声望/贡献/资源倍数；保留空壳供旧调用方兼容（倍数恒 1）
 * @param {object|string|null|undefined} raw
 * @returns {{ reputationGrant: number, contributionGrant: number, resourceMultiplier: number, silverBonus: number }}
 */
function normalizePositionStipendBonuses(raw) {
  return {
    reputationGrant: 0,
    contributionGrant: 0,
    resourceMultiplier: 1,
    silverBonus: getPositionSilverBonus(raw),
  };
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
 * @returns {Promise<number>}
 */
async function loadPositionSilverBonusForPlayer(poolConn, playerId) {
  if (!playerId) return 0;
  const [rows] = await poolConn.query(
    `SELECT cp.position_bonuses
     FROM players p
     LEFT JOIN config_positions cp ON cp.position_id = p.current_position_id
     WHERE p.player_id = ?
     LIMIT 1`,
    [playerId],
  );
  if (!rows.length) return 0;
  return getPositionSilverBonus(rows[0].position_bonuses);
}

/**
 * @deprecated 见 normalizePositionStipendBonuses；兑换侧请改用 loadPositionSilverBonusForPlayer 或倍数 1
 */
async function loadPositionStipendBonusesForPlayer(poolConn, playerId) {
  const silverBonus = await loadPositionSilverBonusForPlayer(poolConn, playerId);
  return {
    reputationGrant: 0,
    contributionGrant: 0,
    resourceMultiplier: 1,
    silverBonus,
  };
}

module.exports = {
  parsePositionBonusesRaw,
  getPositionSilverBonus,
  silverBonusQuotaUnits,
  normalizePositionStipendBonuses,
  applyStipendResourceMultiplier,
  loadPositionSilverBonusForPlayer,
  loadPositionStipendBonusesForPlayer,
};
