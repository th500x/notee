/**
 * 战术格部队阵营色（玩家 / 敌军 / 友军 ally1·ally2），与 TroopLayer、useBattleAnimations 一致。
 */
export function resolveTroopGlowClass(troop) {
  if (troop.faction === 'player') return 'player';
  if (troop.faction === 'enemy') return 'enemy';
  return troop.campaignNpcForce ?? 'ally1';
}
