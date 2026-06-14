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
  const done = clampCompletedOps(completedOpsInWindow);
  if (done >= HALF_DAY_DRAW_LIMIT) return null;
  return getDrawCostForOperationIndex(done + 1);
}

/** 十连抽消耗的本窗操作数（占满半天额度） */
export const BATCH_DRAW_QUOTA_OPS = HALF_DAY_DRAW_LIMIT;

/** 十连额外赠送抽取次数（不计入半天额度） */
export const BATCH_DRAW_BONUS_OPS = 2;

/** 十连实际执行的抽取操作次数（10+2） */
export const BATCH_DRAW_TOTAL_OPS = BATCH_DRAW_QUOTA_OPS + BATCH_DRAW_BONUS_OPS;

function clampCompletedOps(completedOpsInWindow) {
  return Math.max(0, Math.min(HALF_DAY_DRAW_LIMIT, Math.floor(Number(completedOpsInWindow) || 0)));
}

/** 本窗第 1～10 次单抽银两之和（= 十连总价） */
export function getBatchDrawTotalCost() {
  let total = 0;
  for (let i = 1; i <= BATCH_DRAW_QUOTA_OPS; i += 1) {
    total += getDrawCostForOperationIndex(i);
  }
  return total;
}

/** 本窗尚未抽过才可十连（与单抽互斥） */
export function canBatchDraw(completedOpsInWindow) {
  return clampCompletedOps(completedOpsInWindow) === 0;
}
