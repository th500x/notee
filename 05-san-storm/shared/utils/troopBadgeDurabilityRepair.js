/**
 * 部队徽章手动恢复耐久（编组-道具选用目标部队）
 * 须与 troopBadgeDurabilityRepair.cjs 同步。
 * 游戏前端请用 `game/src/utils/troopBadgeDurabilityRepairDisplay.js`（勿在 Vite 里 import 本文件若遇导出异常）。
 *
 * special_effect：`troop_durability_repair_manual`
 * 消耗：传奇 1 枚、核心 2 枚 `item_badge_troop`（仅耐久未满的传奇/核心部队卡）。
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
 * @returns {number|null} 消耗枚数；不可用稀有度返回 null
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
