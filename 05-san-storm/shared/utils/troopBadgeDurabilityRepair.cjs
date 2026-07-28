/**
 * 部队徽章手动恢复耐久（编组-道具选用目标部队）
 * 须与 troopBadgeDurabilityRepair.js 同步。
 */

const TROOP_BADGE_ITEM_ID = 'item_badge_troop';
const TROOP_BADGE_SPECIAL_EFFECT = 'troop_durability_repair_manual';

const TROOP_BADGE_REPAIR_COST_BY_RARITY = Object.freeze({
  legendary: 1,
  core: 2,
});

function troopBadgeRepairCostForRarity(rarity) {
  const r = String(rarity || '').toLowerCase();
  if (r === 'legendary' || r === 'core') return TROOP_BADGE_REPAIR_COST_BY_RARITY[r];
  return null;
}

function isTroopBadgeManualRepairEffect(effect) {
  return String(effect || '').trim() === TROOP_BADGE_SPECIAL_EFFECT;
}

module.exports = {
  TROOP_BADGE_ITEM_ID,
  TROOP_BADGE_SPECIAL_EFFECT,
  TROOP_BADGE_REPAIR_COST_BY_RARITY,
  troopBadgeRepairCostForRarity,
  isTroopBadgeManualRepairEffect,
};
