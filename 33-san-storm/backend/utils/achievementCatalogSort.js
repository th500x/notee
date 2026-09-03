/**
 * 成就目录展示顺序（与 achievement-template.csv 链顺序一致）
 */

/** @type {readonly string[]} */
const CATALOG_CHAIN_ORDER = Object.freeze([
  'chain_combat_win',
  'chain_silver_earn',
  'chain_character_catalog',
  'chain_event_complete',
]);

/**
 * @param {{ chainId?: string|null, chainLevel?: number|null, achievementId?: string }} a
 * @param {{ chainId?: string|null, chainLevel?: number|null, achievementId?: string }} b
 */
function compareAchievementCatalogRows(a, b) {
  const chainA = String(a.chainId || '').trim();
  const chainB = String(b.chainId || '').trim();
  const ia = CATALOG_CHAIN_ORDER.indexOf(chainA);
  const ib = CATALOG_CHAIN_ORDER.indexOf(chainB);
  const orderA = ia === -1 ? 999 : ia;
  const orderB = ib === -1 ? 999 : ib;
  if (orderA !== orderB) return orderA - orderB;

  const levelA = Number(a.chainLevel);
  const levelB = Number(b.chainLevel);
  const la = Number.isFinite(levelA) ? levelA : 0;
  const lb = Number.isFinite(levelB) ? levelB : 0;
  if (la !== lb) return la - lb;

  return String(a.achievementId || '').localeCompare(String(b.achievementId || ''));
}

/**
 * @template T
 * @param {T[]} rows
 * @returns {T[]}
 */
function sortAchievementCatalogRows(rows) {
  return [...rows].sort(compareAchievementCatalogRows);
}

module.exports = {
  CATALOG_CHAIN_ORDER,
  compareAchievementCatalogRows,
  sortAchievementCatalogRows,
};
