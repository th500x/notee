'use strict';

/**
 * 攻城净银两 · 城战奖赏政策入账（11-3 §3.2）
 *
 * @module backend/utils/siegeRewardSettlement
 */

const {
  applyToSiegeReward: applySiegeRewardSplit,
} = require('../../shared/utils/siegeRewardSplitPolicy.cjs');
const factionPolicyService = require('../services/factionPolicyService');

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {{ playerId: string, beneficiaryFactionId: string|null|undefined, netSilver: number }} p
 * @returns {Promise<{
 *   personalSilverEarned: number,
 *   factionSilverToPool: number,
 *   siegeRewardPersonalSharePct: number,
 *   siegeRewardPolicySource: string,
 * }>}
 */
async function creditSiegeNetSilverOnConnection(conn, { playerId, beneficiaryFactionId, netSilver }) {
  const net = Math.trunc(Number(netSilver) || 0);
  const fallbackMeta = {
    personalSilverEarned: 0,
    factionSilverToPool: 0,
    siegeRewardPersonalSharePct: 100,
    siegeRewardPolicySource: 'category_default',
  };
  if (net === 0) return fallbackMeta;

  if (net < 0) {
    await conn.query(
      'UPDATE players SET silver = GREATEST(0, silver + ?) WHERE player_id = ?',
      [net, playerId],
    );
    return {
      personalSilverEarned: net,
      factionSilverToPool: 0,
      siegeRewardPersonalSharePct: 100,
      siegeRewardPolicySource: 'net_loss_personal',
    };
  }

  const siegePolicy = await factionPolicyService.getEffectiveSiegeReward(beneficiaryFactionId);
  const split = applySiegeRewardSplit({
    netSilver: net,
    netFood: 0,
    personalSharePct: siegePolicy.personalSharePct,
  });
  if (split.personalSilver > 0) {
    await conn.query(
      'UPDATE players SET silver = GREATEST(0, silver + ?) WHERE player_id = ?',
      [split.personalSilver, playerId],
    );
  }
  if (split.factionSilver > 0 && beneficiaryFactionId) {
    const factionReserveService = require('../services/factionReserveService');
    await factionReserveService.creditPoolOnConnection(
      conn,
      beneficiaryFactionId,
      { silver: split.factionSilver, food: split.factionFood || 0 },
      { ledgerCategory: factionReserveService.CATEGORY.SIEGE_SETTLEMENT },
    );
  }
  return {
    personalSilverEarned: split.personalSilver,
    factionSilverToPool: split.factionSilver,
    siegeRewardPersonalSharePct: split.personalSharePct,
    siegeRewardPolicySource: siegePolicy.source,
  };
}

module.exports = {
  creditSiegeNetSilverOnConnection,
};
