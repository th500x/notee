/**
 * 战术战斗 · 部队稀有度档位（与 lineupSlots / cardPool 顺序一致）
 * @see game/src/systems/combatSystem.js — 反击低档压制
 */

const TROOP_RARITY_TIER = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  core: 4,
};

/** @param {string|undefined|null} rarity */
function troopRarityTier(rarity) {
  const k = String(rarity ?? 'common').trim().toLowerCase();
  return TROOP_RARITY_TIER[k] ?? 0;
}

/**
 * 反击方比被反击方每低 1 档的叠乘系数（index = 档差）。
 * 同档不应用；高档反击低档不加成。
 */
const COUNTER_LOWER_TIER_DAMAGE_MULT_BY_GAP = [null, 0.44, 0.32, 0.24, 0.20];

/**
 * @param {object|null|undefined} counterAtk 反击方（calcDamage 的 atk）
 * @param {object|null|undefined} victim 被反击方（calcDamage 的 def）
 */
function getCounterLowerTierDamageMult(counterAtk, victim) {
  const gap = troopRarityTier(victim?.rarity) - troopRarityTier(counterAtk?.rarity);
  if (gap <= 0) return 1;
  return COUNTER_LOWER_TIER_DAMAGE_MULT_BY_GAP[gap] ?? COUNTER_LOWER_TIER_DAMAGE_MULT_BY_GAP[4];
}

module.exports = {
  TROOP_RARITY_TIER,
  troopRarityTier,
  COUNTER_LOWER_TIER_DAMAGE_MULT_BY_GAP,
  getCounterLowerTierDamageMult,
};
