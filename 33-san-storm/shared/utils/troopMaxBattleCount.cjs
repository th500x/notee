/**
 * 部队卡本赛季耐久上限（按稀有度）
 * 须与 troopMaxBattleCount.js 同步。
 * 权威对齐：22-1 §4.2 · cardPool / reward / 赛季继承发放。
 */

const MAX_BATTLE_COUNT_BY_RARITY = Object.freeze({
  common: 10,
  rare: 10,
  epic: 20,
  legendary: 20,
  core: 40,
});

/**
 * @param {string|null|undefined} rarity
 * @returns {number}
 */
function getMaxBattleCount(rarity) {
  const key = String(rarity || '').toLowerCase();
  return MAX_BATTLE_COUNT_BY_RARITY[key] ?? 10;
}

module.exports = {
  MAX_BATTLE_COUNT_BY_RARITY,
  getMaxBattleCount,
};
