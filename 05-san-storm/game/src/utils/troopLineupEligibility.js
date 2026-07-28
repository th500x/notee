/**
 * 部队卡是否可在「上阵编组 / 驻地编组」中选装。
 * 与后端 `playerCardLineupService.equipCard` 同口径：
 * - 未过期：可装
 * - 已过期：legendary（橙）与 core（金）可装（战斗磨耗 ×0.8）；白/蓝/紫不可（已删卡）
 */

export function getTroopRarity(card) {
  return card?.config?.rarity || card?.rarity || 'common';
}

export function isTroopBattleExpired(card) {
  const maxBattle = card?.maxBattleCount ?? 10;
  const count = Math.max(0, card?.battleCount ?? 0);
  return count >= maxBattle;
}

export function isTroopEquippableForLineup(card) {
  if (!card || card.cardType !== 'troop') return false;
  if (!isTroopBattleExpired(card)) return true;
  const rarity = getTroopRarity(card);
  return rarity === 'legendary' || rarity === 'core';
}
