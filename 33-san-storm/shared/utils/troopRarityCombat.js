/**
 * 战术战斗 · 部队稀有度档位（与 `troopRarityCombat.cjs` 一致）
 */

export const TROOP_RARITY_TIER = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  core: 4,
};

/** @param {string|undefined|null} rarity */
export function troopRarityTier(rarity) {
  const k = String(rarity ?? 'common').trim().toLowerCase();
  return TROOP_RARITY_TIER[k] ?? 0;
}

/** 反击方低于被反击方时的叠乘表（index = 档差 1～4） */
export const COUNTER_LOWER_TIER_DAMAGE_MULT_BY_GAP = [null, 0.44, 0.32, 0.24, 0.20];

/**
 * @param {object|null|undefined} counterAtk
 * @param {object|null|undefined} victim
 */
export function getCounterLowerTierDamageMult(counterAtk, victim) {
  const gap = troopRarityTier(victim?.rarity) - troopRarityTier(counterAtk?.rarity);
  if (gap <= 0) return 1;
  return COUNTER_LOWER_TIER_DAMAGE_MULT_BY_GAP[gap] ?? COUNTER_LOWER_TIER_DAMAGE_MULT_BY_GAP[4];
}
