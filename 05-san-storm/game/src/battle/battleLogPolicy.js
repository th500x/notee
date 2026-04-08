/**
 * 战役战报入库优化：可省略友军 NPC（faction === 'ally'）相关流水，
 * 仅保留玩家部队（player）与敌军（enemy）之间的词条，缩小 battle_log 体积。
 */

/** 单部队相关日志（回合开始、移动、烈火、陷阱等） */
export function trimSkipForTroop(trimAllyBattleLog, troop) {
  return !!(trimAllyBattleLog && troop && troop.faction === 'ally');
}

/** 攻防双方词条（普攻/暴击/技能等） */
export function trimSkipForCombatPair(trimAllyBattleLog, atk, def) {
  if (!trimAllyBattleLog) return false;
  return atk?.faction === 'ally' || def?.faction === 'ally';
}
