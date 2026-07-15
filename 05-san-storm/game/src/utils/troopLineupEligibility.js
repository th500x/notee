/**
 * 部队卡是否可在「上阵编组 / 驻地编组」中选装。
 * 与后端 `playerCardLineupService.equipCard`、`aiPlayerLineupService.troopEquippable` 同口径：
 * - 未过期：可装
 * - 已过期：仅 legendary（橙）可装；core（金）等不可再装
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
  return getTroopRarity(card) === 'legendary';
}
