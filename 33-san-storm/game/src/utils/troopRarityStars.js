/**
 * 战术格名条旁稀有度星标（与卡面稀有度色一致：灰/蓝/紫/橙/黄）
 */

/** @type {Record<string, string>} */
export const TROOP_RARITY_STAR_COLOR = {
  common: '#9ca3af',
  rare: '#60a5fa',
  epic: '#c084fc',
  legendary: '#fb923c',
  core: '#facc15',
};

/** @type {Record<string, number>} */
export const TROOP_RARITY_STAR_COUNT = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  core: 5,
};

/**
 * @param {string|undefined|null} rarity
 * @returns {{ key: string, count: number, color: string, layout: string }}
 */
export function resolveTroopRarityStars(rarity) {
  const key = String(rarity || 'common').trim().toLowerCase();
  const known = TROOP_RARITY_STAR_COUNT[key] != null ? key : 'common';
  return {
    key: known,
    count: TROOP_RARITY_STAR_COUNT[known],
    color: TROOP_RARITY_STAR_COLOR[known],
    layout: known,
  };
}

/**
 * DOM 名条用稀有度星 HTML
 * @param {string|undefined|null} rarity
 */
export function troopRarityStarsHtml(rarity) {
  const { count, color, layout } = resolveTroopRarityStars(rarity);
  const stars = Array.from({ length: count }, () => '<i aria-hidden="true">★</i>').join('');
  return `<span class="troop-rarity-stars layout-${layout}" style="color:${color}" title="">${stars}</span>`;
}
