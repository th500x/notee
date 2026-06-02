/**
 * ESM 镜像 · 须与 cardPoolRarityLimits.cjs 保持同步（13-3 §7）
 * @module shared/utils/cardPoolRarityLimits
 */

/** 将领：按赛季 Tab 计数范围内该稀有度实例数上限 */
export const CHARACTER_LIMIT_BY_RARITY = { legendary: 10, epic: 20, rare: 20, common: 10 };

/** 部队：按赛季 Tab 计数范围内该稀有度实例数上限 */
export const TROOP_LIMIT_BY_RARITY = { common: 20, rare: 40, epic: 40, legendary: 20 };

export const DEFAULT_POOL_SEASON = 'san_1';

export const RECRUIT_EXPANSION_POOL_SEASON = 'san_0';

function normRarity(rarity) {
  return String(rarity || 'common').toLowerCase();
}

/**
 * @param {{ enabled?: boolean, san0Band?: string|null }|null|undefined} recruit
 * @param {{ basePoolSeason?: string, recruitPoolSeason?: string }} [opts]
 */
export function isRecruitCrossSeasonLimitPool(recruit, opts = {}) {
  const basePoolSeason = opts.basePoolSeason ?? DEFAULT_POOL_SEASON;
  const recruitPoolSeason = opts.recruitPoolSeason ?? RECRUIT_EXPANSION_POOL_SEASON;
  if (!recruit?.enabled || !String(recruit.san0Band ?? '').trim()) return false;
  if (recruitPoolSeason === basePoolSeason) return false;
  return true;
}

/**
 * @param {string} rarity
 * @param {{ recruitCrossSeasonActive?: boolean }} [opts]
 */
export function getCharacterRarityLimit(rarity, opts = {}) {
  const base = CHARACTER_LIMIT_BY_RARITY[normRarity(rarity)] ?? null;
  if (base == null) return null;
  return opts.recruitCrossSeasonActive ? base * 2 : base;
}

export function getTroopRarityLimit(rarity) {
  return TROOP_LIMIT_BY_RARITY[normRarity(rarity)] ?? null;
}

/**
 * @param {number} count
 * @param {'character'|'troop'} cardType
 * @param {string} rarity
 * @param {{ recruitCrossSeasonActive?: boolean }} [opts]
 */
export function formatRarityCountWithLimit(count, cardType, rarity, opts = {}) {
  const n = Math.max(0, Number(count) || 0);
  const max =
    cardType === 'character'
      ? getCharacterRarityLimit(rarity, opts)
      : cardType === 'troop'
        ? getTroopRarityLimit(rarity)
        : null;
  if (max == null) return String(n);
  return `${n}/${max}`;
}
