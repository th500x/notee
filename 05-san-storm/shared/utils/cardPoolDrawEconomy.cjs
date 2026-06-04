/**
 * 封赏卡池 · 半天窗抽取次数与银两梯度（13-3 §5.1）
 * @module shared/utils/cardPoolDrawEconomy
 */

/** 每半天窗（08:00 / 12:00 锚点）每池最多操作次数 */
const HALF_DAY_DRAW_LIMIT = 10;

/** 银两梯度：前 3 次 30 → 中 3 次 50 → 后 4 次 70（将领/部队共用） */
const DRAW_COST_TIERS = Object.freeze([
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

/** @param {number} opIndexOneBased 本窗第几次操作（1～10，含本次） */
function getDrawCostForOperationIndex(opIndexOneBased) {
  const idx = assertDrawOperationIndex(opIndexOneBased);
  let cursor = 0;
  for (const tier of DRAW_COST_TIERS) {
    cursor += tier.count;
    if (idx <= cursor) return tier.cost;
  }
  return DRAW_COST_TIERS[DRAW_COST_TIERS.length - 1].cost;
}

/** @param {number} completedOpsInWindow 本窗已完成操作数（0～10） */
function getNextDrawCost(completedOpsInWindow) {
  const done = Math.max(0, Math.min(HALF_DAY_DRAW_LIMIT, Math.floor(Number(completedOpsInWindow) || 0)));
  if (done >= HALF_DAY_DRAW_LIMIT) return null;
  return getDrawCostForOperationIndex(done + 1);
}

module.exports = {
  HALF_DAY_DRAW_LIMIT,
  DRAW_COST_TIERS,
  getDrawCostForOperationIndex,
  getNextDrawCost,
};
