/**
 * 主阵容「已装备部队」总兵力 — 与后端 garrisonService.sumMainLineupEquippedTroopTroops 一致
 * （card_type=troop & is_equipped；current_troops 缺省则用 max+bonus）
 */

/** 开战 / 攻城等战斗入口：上阵编组总兵力下限（全战斗通用） */
export const MIN_MAIN_LINEUP_TROOPS_BATTLE = 200;

export function sumEquippedTroopTroopsFromCards(cards) {
  if (!Array.isArray(cards)) return 0;
  const troops = cards.filter(c => c.card_type === 'troop' && c.is_equipped);
  return troops.reduce((s, c) => {
    const cfg = c.config || {};
    const max = (cfg.maxTroops || 0) + (c.bonus_max_troops || 0);
    return s + (c.current_troops ?? max);
  }, 0);
}

/**
 * @param {Array|null|undefined} cards PlayerContext.cards（优先）
 * @param {Array|null|undefined} playerUnits buildPlayerUnitsFromContext 结果（无 cards 时回退）
 */
export function getMainLineupTroopTotalForBattleGate(cards, playerUnits) {
  if (cards?.length) return sumEquippedTroopTroopsFromCards(cards);
  if (playerUnits?.length) {
    return playerUnits.reduce((s, u) => s + (u.currentTroops ?? 0), 0);
  }
  return 0;
}

/**
 * 出征粮草消耗（与 LineupTab 出征消耗一致）：每支已装备部队 ceil(当前兵力/20)，再求和。
 * 开战前须 player.food >= 本值。
 */
export function getMainLineupBattleFoodDeployCost(cards, playerUnits) {
  if (cards?.length) {
    const troops = cards.filter((c) => c.card_type === 'troop' && c.is_equipped);
    return troops.reduce((s, c) => {
      const cfg = c.config || {};
      const max = (cfg.maxTroops || 0) + (c.bonus_max_troops || 0);
      const current = c.current_troops ?? max;
      return s + Math.ceil(Math.max(0, current) / 20);
    }, 0);
  }
  if (playerUnits?.length) {
    return playerUnits.reduce(
      (s, u) => s + Math.ceil(Math.max(0, u.currentTroops ?? 0) / 20),
      0
    );
  }
  return 0;
}
