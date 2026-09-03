/**
 * 主阵容「已装备部队」总兵力 — 与后端 garrisonService.sumMainLineupEquippedTroopTroops 一致
 * （card_type=troop & is_equipped；current_troops 缺省则用 max+bonus）
 */

/** 开战 / 攻城等战斗入口：上阵编组总兵力下限（全战斗通用） */
export const MIN_MAIN_LINEUP_TROOPS_BATTLE = 200;

export function sumEquippedTroopTroopsFromCards(cards) {
  if (!Array.isArray(cards)) return 0;
  const troops = cards.filter(c => c.cardType === 'troop' && c.isEquipped);
  return troops.reduce((s, c) => {
    const cfg = c.config || {};
    const max = (cfg.maxTroops || 0) + (c.bonusMaxTroops || 0);
    return s + (c.currentTroops ?? max);
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
    const troops = cards.filter((c) => c.cardType === 'troop' && c.isEquipped);
    return troops.reduce((s, c) => {
      const cfg = c.config || {};
      const max = (cfg.maxTroops || 0) + (c.bonusMaxTroops || 0);
      const current = c.currentTroops ?? max;
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

/**
 * 开战前校验（与 BattleArena 一致）：兵力下限、出征粮草。
 * 应在进入战斗地图 UI 之前调用，避免玩家困在无出口的准备界面。
 *
 * @param {{ recordOnly?: boolean, cards?: Array|null, playerUnits?: Array|null, playerFood?: number }} p
 * @returns {{ ok: boolean, message?: string }}
 */
export function validateMainLineupBattleGate({
  recordOnly = false,
  cards = null,
  playerUnits = null,
  playerFood = 0,
  /** 守方打攻方大本营等：出征粮草 = 常规 × 倍数（默认 1） */
  foodCostMultiplier = 1,
}) {
  if (recordOnly) return { ok: true };
  const lineupTroopTotal = getMainLineupTroopTotalForBattleGate(cards, playerUnits);
  if (lineupTroopTotal < MIN_MAIN_LINEUP_TROOPS_BATTLE) {
    return {
      ok: false,
      message: `上阵编组总兵力需≥${MIN_MAIN_LINEUP_TROOPS_BATTLE}（当前 ${lineupTroopTotal}）。`,
    };
  }
  const baseNeed = getMainLineupBattleFoodDeployCost(cards, playerUnits);
  const mult = Math.max(1, Math.floor(Number(foodCostMultiplier) || 1));
  const need = baseNeed * mult;
  const have = Number(playerFood) || 0;
  if (have < need) {
    return {
      ok: false,
      message: mult > 1
        ? `出征需粮草 ${need}（常规 ${baseNeed} × ${mult}；当前 ${have}），粮草不足。`
        : `出征需粮草 ${need}（当前 ${have}），粮草不足。`,
    };
  }
  return { ok: true };
}
