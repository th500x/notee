/**
 * 战役/特殊战斗规则：主将身份（hero/boss）与 NPC AI 战斗风格。
 * 策划与 CSV 约定见 docs/tools/campaign/CAMPAIGN_MAP.md
 *
 * 部队对象可选字段：
 * - commanderRole: 'hero' | 'boss' — 可选；友军 hero：同一将领（`campaignCharId`）下**全部**带 hero 的 stack 灭尽才败；无 `campaignCharId` 时退化为「任一支 hero stack 灭即败」。敌军 boss：**全部**带 boss 标记的敌方 stack 歼灭后战役胜利（同一将领多支 stack 均须消灭）
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
 * @param {object} troop 刚被歼灭、currentTroops 已为 0 的部队
 * @param {object[]} allTroops 当前战场全部部队引用（用于判断 boss 是否仍有存活 stack）
 * @returns {'player_win'|'enemy_win'|null}
 */
export function outcomeIfCommanderEliminated(troop, allTroops = []) {
  if (!troop || troop.currentTroops > 0) return null;
  if (isOurSideHeroTroop(troop)) {
    const gid = troop.campaignCharId;
    if (gid != null && String(gid) !== '') {
      const gKey = String(gid);
      const anyHeroStackAlive = allTroops.some(
        (t) =>
          t.currentTroops > 0 &&
          isOurSideHeroTroop(t) &&
          t.campaignCharId != null &&
          String(t.campaignCharId) === gKey,
      );
      if (anyHeroStackAlive) return null;
    }
    return 'enemy_win';
  }
  if (isEnemyBossTroop(troop)) {
    const anyBossAlive = allTroops.some(
      (t) => t.currentTroops > 0 && isEnemyBossTroop(t),
    );
    if (!anyBossAlive) return 'player_win';
  }
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
