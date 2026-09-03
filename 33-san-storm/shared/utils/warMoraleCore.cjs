/**
 * 战事竞态士气 · 纯函数（17-3 §7.4）
 * 与 player_cards.morale、17-1 战术士气无关。
 *
 * @module shared/utils/warMoraleCore
 */

/** 单方士气上限 / 竞态终点 */
const WAR_MORALE_MAX = 120;

/** 双方士气之和恒为 120 */
const WAR_MORALE_POOL = 120;

/** 线性公式 K = 40 × 101/99 */
const WAR_MORALE_K = (40 * 101) / 99;

/** 城市数钳制上下界（含） */
const WAR_MORALE_CITY_MIN = 1;
const WAR_MORALE_CITY_MAX = 100;

/** 初始公式版本（side_stats.warMoraleInit.formulaVersion） */
const WAR_MORALE_FORMULA_VERSION = 1;

/** 披挂 / 驻地 自动对决零和增量 */
const WAR_MORALE_AUTO_DUEL_DELTA = 1;

function clampCityCount(raw) {
  const n = Math.floor(Number(raw) || 0);
  if (n < WAR_MORALE_CITY_MIN) return WAR_MORALE_CITY_MIN;
  if (n > WAR_MORALE_CITY_MAX) return WAR_MORALE_CITY_MAX;
  return n;
}

/**
 * @param {number} attackerCityCount
 * @param {number} defenderCityCount
 * @returns {{ attackerWarMorale: number, defenderWarMorale: number, formulaVersion: number }}
 */
function computeInitialWarMoralePair(attackerCityCount, defenderCityCount) {
  const cAtt = clampCityCount(attackerCityCount);
  const cDef = clampCityCount(defenderCityCount);
  const rawAtt =
    60 + (WAR_MORALE_K * (cDef - cAtt)) / (cAtt + cDef);
  const att = Math.round(Math.max(20, Math.min(100, rawAtt)));
  const def = WAR_MORALE_POOL - att;
  return {
    attackerWarMorale: att,
    defenderWarMorale: def,
    formulaVersion: WAR_MORALE_FORMULA_VERSION,
  };
}

/**
 * @param {number|null|undefined} attackerWarMorale
 * @param {number|null|undefined} defenderWarMorale
 * @param {boolean} attackerWon
 * @returns {{ attackerWarMorale: number, defenderWarMorale: number }}
 */
function applyPvpAutoDuelMoraleDelta(attackerWarMorale, defenderWarMorale, attackerWon) {
  let att = Math.round(Number(attackerWarMorale) || 0);
  let def = Math.round(Number(defenderWarMorale) || 0);
  if (attackerWon) {
    att += WAR_MORALE_AUTO_DUEL_DELTA;
    def -= WAR_MORALE_AUTO_DUEL_DELTA;
  } else {
    att -= WAR_MORALE_AUTO_DUEL_DELTA;
    def += WAR_MORALE_AUTO_DUEL_DELTA;
  }
  att = Math.max(0, Math.min(WAR_MORALE_MAX, att));
  def = WAR_MORALE_POOL - att;
  return { attackerWarMorale: att, defenderWarMorale: def };
}

/**
 * @param {number} attackerWarMorale
 * @param {number} defenderWarMorale
 * @returns {'attacker'|'defender'|null}
 */
function resolveWarMoraleRaceWinner(attackerWarMorale, defenderWarMorale) {
  const att = Math.round(Number(attackerWarMorale) || 0);
  const def = Math.round(Number(defenderWarMorale) || 0);
  if (att >= WAR_MORALE_MAX) return 'attacker';
  if (def >= WAR_MORALE_MAX) return 'defender';
  return null;
}

/**
 * @param {object|null|undefined} sideStats
 * @returns {boolean}
 */
function hasWarMoraleInit(sideStats) {
  const init = sideStats && typeof sideStats === 'object' ? sideStats.warMoraleInit : null;
  return !!(init && typeof init === 'object' && init.formulaVersion != null);
}

/**
 * @param {number} attackerCityCount
 * @param {number} defenderCityCount
 */
function buildWarMoraleInitSnapshot(attackerCityCount, defenderCityCount) {
  return {
    attackerCityCount: clampCityCount(attackerCityCount),
    defenderCityCount: clampCityCount(defenderCityCount),
    formulaVersion: WAR_MORALE_FORMULA_VERSION,
  };
}

module.exports = {
  WAR_MORALE_MAX,
  WAR_MORALE_POOL,
  WAR_MORALE_AUTO_DUEL_DELTA,
  WAR_MORALE_FORMULA_VERSION,
  clampCityCount,
  computeInitialWarMoralePair,
  applyPvpAutoDuelMoraleDelta,
  resolveWarMoraleRaceWinner,
  hasWarMoraleInit,
  buildWarMoraleInitSnapshot,
};
