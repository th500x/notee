/**
 * ESM 镜像 · 须与 cardPoolDrawEconomy.cjs 保持同步（13-3 §5.1）
 * @module shared/utils/cardPoolDrawEconomy
 */

export const HALF_DAY_DRAW_LIMIT = 10;

export const DRAW_COST_TIERS = Object.freeze([
  { count: 3, cost: 30 },
  { count: 3, cost: 50 },
  { count: 4, cost: 70 },
]);

function assertDrawOperationIndex(opIndex) {
  const n = Math.floor(Number(opIndex));
  if (!Number.isFinite(n) || n < 1 || n > HALF_DAY_DRAW_LIMIT) {
    throw new Error(`无效的卡池操作序号（须 1～${HALF_DAY_DRAW_LIMIT}）`);
  }
  return n;
}

export function getDrawCostForOperationIndex(opIndexOneBased) {
  const idx = assertDrawOperationIndex(opIndexOneBased);
  let cursor = 0;
  for (const tier of DRAW_COST_TIERS) {
    cursor += tier.count;
    if (idx <= cursor) return tier.cost;
  }
  return DRAW_COST_TIERS[DRAW_COST_TIERS.length - 1].cost;
}

export function getNextDrawCost(completedOpsInWindow) {
  const done = Math.max(0, Math.min(HALF_DAY_DRAW_LIMIT, Math.floor(Number(completedOpsInWindow) || 0)));
  if (done >= HALF_DAY_DRAW_LIMIT) return null;
  return getDrawCostForOperationIndex(done + 1);
}
