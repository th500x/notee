/**
 * 部队徽章手动恢复耐久（编组-道具）
 * 纯 ESM 副本，须与 shared/utils/troopBadgeDurabilityRepair.cjs 同步。
 * 勿从本文件 re-export .cjs（Vite 白屏）。
 */

export const TROOP_BADGE_ITEM_ID = 'item_badge_troop';
export const TROOP_BADGE_SPECIAL_EFFECT = 'troop_durability_repair_manual';

/** @type {Readonly<Record<'legendary'|'core', number>>} */
export const TROOP_BADGE_REPAIR_COST_BY_RARITY = Object.freeze({
  legendary: 1,
  core: 2,
});

/**
 * @param {string|null|undefined} rarity
 * @returns {number|null}
 */
export function troopBadgeRepairCostForRarity(rarity) {
  const r = String(rarity || '').toLowerCase();
  if (r === 'legendary' || r === 'core') return TROOP_BADGE_REPAIR_COST_BY_RARITY[r];
  return null;
}

/**
 * @param {string|null|undefined} effect
 */
export function isTroopBadgeManualRepairEffect(effect) {
  return String(effect || '').trim() === TROOP_BADGE_SPECIAL_EFFECT;
}

/**
 * @param {{ itemId?: string, specialEffect?: string|null }|null|undefined} item
 * @returns {boolean} 编组-道具中可点选使用（当前：部队徽章）
 */
export function isUsableInventoryItem(item) {
  if (!item) return false;
  if (item.itemId === TROOP_BADGE_ITEM_ID) return true;
  return isTroopBadgeManualRepairEffect(item.specialEffect);
}
