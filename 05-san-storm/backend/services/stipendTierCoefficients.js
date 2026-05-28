/**
 * 国力档 → 俸禄 / 势力储备日恢复 共用系数与随机 roll（无其它 service 依赖，避免循环 require）。
 *
 * @see sanGongStipendService.js · factionReserveRecoveryService.js
 */

/** 国力档位 → 银两基准系数（粮草 = 本次银两 × 5，同一随机因子） */
const SILVER_COEFFICIENT_BY_TIER = Object.freeze({
  S: 300,
  A: 240,
  B: 180,
  C: 120,
  D: 60,
});

/**
 * @returns {number} 80..120
 */
function randomStipendPercentInclusive() {
  return 80 + Math.floor(Math.random() * 41);
}

/**
 * @param {string} tier
 * @returns {{ silver: number, food: number, rollPercent: number, tierCoeff: number } | null}
 */
function rollStipendAmountsForTier(tier) {
  const t = String(tier || '').toUpperCase();
  const coeff = SILVER_COEFFICIENT_BY_TIER[t];
  if (coeff == null) return null;
  const rollPercent = randomStipendPercentInclusive();
  const silver = Math.floor((coeff * rollPercent) / 100);
  const food = silver * 5;
  return { silver, food, rollPercent, tierCoeff: coeff };
}

module.exports = {
  SILVER_COEFFICIENT_BY_TIER,
  randomStipendPercentInclusive,
  rollStipendAmountsForTier,
};
