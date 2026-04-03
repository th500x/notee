/**
 * 战役/特殊战斗规则：主将身份（hero/boss）与 NPC AI 战斗风格。
 * 策划与 CSV 约定见 docs/tools/campaign/CAMPAIGN_MAP_NARRATIVE_SPEC.md
 *
 * 部队对象可选字段：
 * - commanderRole: 'hero' | 'boss' — 可选；任一名 hero 败则战役失败，任一名 boss 败则战役胜利（可配置多名）
 * - battleAiStyle: 'attack' | 'defense' | 'balanced' — 仅 AI 行动的单位；由战役配置写入
 */

/** @type {const} */
export const AI_BATTLE_STYLE = {
  ATTACK: 'attack',
  DEFENSE: 'defense',
  BALANCED: 'balanced',
};

/** @type {const} */
export const COMMANDER_ROLE = {
  HERO: 'hero',
  BOSS: 'boss',
};

/**
 * 我方首领（hero）：玩家阵营或战役 NPC 友军 ally1/ally2（见 campaignNpcForce）
 */
function isOurSideHeroTroop(troop) {
  if (troop.commanderRole !== COMMANDER_ROLE.HERO) return false;
  if (troop.faction === 'player') return true;
  const f = troop.campaignNpcForce;
  return f === 'ally1' || f === 'ally2';
}

/**
 * 敌方首领（boss）
 */
function isEnemyBossTroop(troop) {
  if (troop.commanderRole !== COMMANDER_ROLE.BOSS) return false;
  if (troop.faction === 'enemy') return true;
  return troop.campaignNpcForce === 'enemy';
}

/**
 * 某部队被歼灭后的即时战役胜负（与普通「全歼」独立）
 * @returns {'player_win'|'enemy_win'|null}
 */
export function outcomeIfCommanderEliminated(troop) {
  if (!troop || troop.currentTroops > 0) return null;
  if (isOurSideHeroTroop(troop)) return 'enemy_win';
  if (isEnemyBossTroop(troop)) return 'player_win';
  return null;
}

/**
 * 归一化 AI 风格（用于 findBestMoveTarget）
 * @param {object} troop
 * @returns {'attack'|'defense'|'balanced'}
 */
export function getBattleAiStyle(troop) {
  const s = troop?.battleAiStyle ?? troop?.aiBattleStyle;
  if (s === AI_BATTLE_STYLE.ATTACK || s === 'attack') return 'attack';
  if (s === AI_BATTLE_STYLE.DEFENSE || s === 'defense') return 'defense';
  return 'balanced';
}
