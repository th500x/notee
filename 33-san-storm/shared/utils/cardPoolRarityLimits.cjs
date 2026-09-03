/**
 * 卡池按稀有度持有上限（13-3 §7 · 22-1 §6.1）
 * 须与 cardPoolRarityLimits.js 保持同步。
 * @module shared/utils/cardPoolRarityLimits
 */

/** 将领：按赛季 Tab 计数范围内该稀有度实例数上限 */
const CHARACTER_LIMIT_BY_RARITY = { legendary: 10, epic: 20, rare: 20, common: 10 };

/** 部队：按赛季 Tab 计数范围内该稀有度实例数上限（core 走同 card_id 最多 2 张，见 rewardService） */
const TROOP_LIMIT_BY_RARITY = { common: 20, rare: 40, epic: 40, legendary: 20 };

/** 卡池主赛季（与 `seasonLabels.PLAYABLE_POOL_SEASON` 一致） */
const DEFAULT_POOL_SEASON = 'san_1';

/** 招贤纳士扩池赛季（楚汉 Tab；与 `seasonLabels.RECRUIT_POOL_SEASON` 一致） */
const RECRUIT_EXPANSION_POOL_SEASON = 'san_0';

function normRarity(rarity) {
  return String(rarity || 'common').toLowerCase();
}

/**
 * 招贤扩池是否构成「独立上限池」（军营展示 max ×2；将领 `poolSeason` 分 Tab 计数）。
 * - 跨赛季（如 san_1 + 招贤 san_0）→ true
 * - 同赛季仅扩他势力段（未来）→ false
 *
 * @param {{ enabled?: boolean, san0Band?: string|null }|null|undefined} recruit
 * @param {{ basePoolSeason?: string, recruitPoolSeason?: string }} [opts]
 */
function isRecruitCrossSeasonLimitPool(recruit, opts = {}) {
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
function getCharacterRarityLimit(rarity, opts = {}) {
  const base = CHARACTER_LIMIT_BY_RARITY[normRarity(rarity)] ?? null;
  if (base == null) return null;
  return opts.recruitCrossSeasonActive ? base * 2 : base;
}

function getTroopRarityLimit(rarity) {
  return TROOP_LIMIT_BY_RARITY[normRarity(rarity)] ?? null;
}

/**
 * @param {number} count
 * @param {'character'|'troop'} cardType
 * @param {string} rarity
 * @param {{ recruitCrossSeasonActive?: boolean }} [opts]
 * @returns {string} 如 `6/10`；无上限配置时仅返回 count
 */
function formatRarityCountWithLimit(count, cardType, rarity, opts = {}) {
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

module.exports = {
  CHARACTER_LIMIT_BY_RARITY,
  TROOP_LIMIT_BY_RARITY,
  DEFAULT_POOL_SEASON,
  RECRUIT_EXPANSION_POOL_SEASON,
  isRecruitCrossSeasonLimitPool,
  getCharacterRarityLimit,
  getTroopRarityLimit,
  formatRarityCountWithLimit,
};
