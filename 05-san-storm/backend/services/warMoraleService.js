/**
 * 战事竞态士气 · 服务层（17-3 §7.4）
 * 纯公式见 shared/utils/warMoraleCore.cjs
 *
 * @module services/warMoraleService
 */

const { pool } = require('../database/connection');
const WarPvp = require('../models/WarPvp');
const warMoraleCore = require('../../shared/utils/warMoraleCore.cjs');

const { hasWarMoraleInit } = warMoraleCore;

/**
 * 全图势力拥有城数（status = owned），开战快照用。
 * @param {string} factionId
 * @param {object} [conn]
 */
async function fetchFactionOwnedCityCount(factionId, conn = null) {
  const runner = conn || pool;
  const [rows] = await runner.query(
    "SELECT COUNT(*) AS c FROM cities WHERE faction_id = ? AND status = 'owned'",
    [factionId],
  );
  return Number(rows[0]?.c || 0);
}

/**
 * @param {object} war - formatPvpWarRow
 * @returns {boolean}
 */
function warHasActiveMorale(war) {
  return hasWarMoraleInit(war?.sideStats);
}

/**
 * @param {number} attackerCityCount
 * @param {number} defenderCityCount
 */
function computeInitialPair(attackerCityCount, defenderCityCount) {
  return warMoraleCore.computeInitialWarMoralePair(attackerCityCount, defenderCityCount);
}

/**
 * @param {object} war
 * @param {boolean} attackerWon
 * @returns {{ attackerWarMorale: number, defenderWarMorale: number } | null}
 */
function applySkirmishDeltaForWar(war, attackerWon) {
  if (!warHasActiveMorale(war)) return null;
  return warMoraleCore.applySkirmishWarMoraleDelta(
    war.attackerWarMorale,
    war.defenderWarMorale,
    attackerWon,
  );
}

/**
 * @param {number} attackerWarMorale
 * @param {number} defenderWarMorale
 * @returns {{ winnerSide: 'attacker'|'defender', winnerFactionId: string, victoryCondition: string } | null}
 */
function checkRaceTermination(attackerWarMorale, defenderWarMorale, war) {
  const side = warMoraleCore.resolveWarMoraleRaceWinner(attackerWarMorale, defenderWarMorale);
  if (!side) return null;
  return {
    winnerSide: side,
    winnerFactionId:
      side === 'attacker' ? war.attackerFactionId : war.defenderFactionId,
    victoryCondition: WarPvp.WAR_PVP_VICTORY_CONDITIONS.WAR_MORALE_RACE,
  };
}

/**
 * 落营激活：快照城市数 + 写入初始士气。
 * @param {object} conn
 * @param {object} war
 * @returns {Promise<{ attackerWarMorale: number, defenderWarMorale: number, sideStats: object }>}
 */
async function initWarMoraleOnActivate(conn, war) {
  const attCount = await fetchFactionOwnedCityCount(war.attackerFactionId, conn);
  const defCount = await fetchFactionOwnedCityCount(war.defenderFactionId, conn);
  const pair = computeInitialPair(attCount, defCount);
  return {
    attackerWarMorale: pair.attackerWarMorale,
    defenderWarMorale: pair.defenderWarMorale,
    warMoraleInit: warMoraleCore.buildWarMoraleInitSnapshot(attCount, defCount),
  };
}

module.exports = {
  warHasActiveMorale,
  fetchFactionOwnedCityCount,
  computeInitialPair,
  applySkirmishDeltaForWar,
  checkRaceTermination,
  initWarMoraleOnActivate,
  ...warMoraleCore,
};
