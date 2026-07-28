/**
 * 攻城开战预检：持有兵符数（与匪寨 `item_tactic_token` 同源）。
 * 真正扣减在后端 `consumeSiegeQuotaForBattleStart`（initiate API 内）。
 */

export const SIEGE_TACTIC_TOKEN_ITEM_ID = 'item_tactic_token';
export const SIEGE_TACTIC_TOKEN_COST = 1;

/**
 * @param {object|null|undefined} player - PlayerContext / profile（`items` 为 `{ [itemId]: number }`）
 * @returns {number}
 */
export function countPlayerTacticTokens(player) {
  const raw = player?.items;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 0;
  return Math.max(0, Math.floor(Number(raw[SIEGE_TACTIC_TOKEN_ITEM_ID]) || 0));
}

/**
 * @param {object|null|undefined} player
 * @returns {{ loaded: boolean, remaining: number, costPerBattle: number, canSiege: boolean }}
 */
export function buildSiegeTacticTokenQuota(player) {
  const remaining = countPlayerTacticTokens(player);
  return {
    loaded: !!player?.playerId,
    remaining,
    costPerBattle: SIEGE_TACTIC_TOKEN_COST,
    canSiege: remaining >= SIEGE_TACTIC_TOKEN_COST,
  };
}
