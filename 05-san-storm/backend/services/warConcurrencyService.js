/**
 * 攻方势力战事并发上限：PVE（wars 参与）∪ PVP（wars_pvp active/pending）合计至多 1。
 * @see docs/01-jun-exploration/10-core-system/17-3-WAR_SYSTEM.md §1
 * @module backend/services/warConcurrencyService
 */

const MAX_CONCURRENT_WARS_PER_ATTACKER_FACTION = 1;

const WAR_CAP_MESSAGE =
  `贵方势力已有进行中的战事（PVE/PVP 合计上限 ${MAX_CONCURRENT_WARS_PER_ATTACKER_FACTION}），请先结束后再开`;

/**
 * @param {string} factionId
 * @param {{ season?: string, excludePveWarId?: string }} [opts]
 * @returns {Promise<{
 *   pvpCount: number,
 *   pveCount: number,
 *   total: number,
 *   pveWars: object[],
 *   atCap: boolean,
 *   max: number,
 * }>}
 */
async function getAttackerFactionWarLoad(factionId, opts = {}) {
  const fid = String(factionId || '').trim();
  if (!fid) {
    return {
      pvpCount: 0,
      pveCount: 0,
      total: 0,
      pveWars: [],
      atCap: false,
      max: MAX_CONCURRENT_WARS_PER_ATTACKER_FACTION,
    };
  }

  const WarPvp = require('../models/WarPvp');
  const cityService = require('./cityService');

  const [pvpCountRaw, pvePart] = await Promise.all([
    WarPvp.countActiveOrPendingByAttackerFaction(fid),
    cityService.getActivePveSiegeParticipationForFaction(fid, {
      season: opts.season,
      excludeWarId: opts.excludePveWarId,
    }),
  ]);

  const pvpCount = Number(pvpCountRaw) || 0;
  const pveCount = Number(pvePart?.count) || 0;
  const total = pvpCount + pveCount;
  return {
    pvpCount,
    pveCount,
    total,
    pveWars: Array.isArray(pvePart?.wars) ? pvePart.wars : [],
    atCap: total >= MAX_CONCURRENT_WARS_PER_ATTACKER_FACTION,
    max: MAX_CONCURRENT_WARS_PER_ATTACKER_FACTION,
  };
}

/**
 * 新开战事（新 PVE 行 / 新加入他城 PVE / 新 PVP 草案）前调用。
 * @param {string} factionId
 * @param {{ season?: string, excludePveWarId?: string }} [opts]
 */
async function assertCanOpenNewWar(factionId, opts = {}) {
  const load = await getAttackerFactionWarLoad(factionId, opts);
  if (load.atCap) {
    const err = new Error(WAR_CAP_MESSAGE);
    err.code = 'WAR_CONCURRENCY_CAP';
    throw err;
  }
  return load;
}

module.exports = {
  MAX_CONCURRENT_WARS_PER_ATTACKER_FACTION,
  WAR_CAP_MESSAGE,
  getAttackerFactionWarLoad,
  assertCanOpenNewWar,
};
