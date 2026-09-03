/**
 * 封赏卡池 · 半天窗双通道（银两十连 / 真三徽章抽）与银两总价（13-3 §5.1）
 * @module shared/utils/cardPoolDrawEconomy
 */

/** 银两十连 / 真三徽章抽：各占本半天窗 1 次机会（两路独立） */
const HALF_DAY_CHANNEL_SLOT_LIMIT = 1;

/** 兼容旧字段名：单通道内「额度权重」仍按 10 记（十连前 10 次） */
const HALF_DAY_DRAW_LIMIT = 10;

const DRAW_CHANNEL_SILVER = 'silver';
const DRAW_CHANNEL_BADGE = 'badge';

/** 真三徽章抽消耗 */
const BADGE_BATCH_ITEM_ID = 'item_badge_storm';
const BADGE_BATCH_COST = 1;

/** 本窗两路合计机会数（徽章抽 + 银两十连） */
const HALF_DAY_TOTAL_SLOTS = 2;

/** @deprecated 旧单抽银两梯度；银两十连总价仍按此表求和 */
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

/** @deprecated 单抽已废止；保留供旧调用方 */
function getNextDrawCost(completedOpsInWindow) {
  const done = clampCompletedOps(completedOpsInWindow);
  if (done >= HALF_DAY_DRAW_LIMIT) return null;
  return getDrawCostForOperationIndex(done + 1);
}

/** 十连抽消耗的通道额度权重（占满银两通道） */
const BATCH_DRAW_QUOTA_OPS = HALF_DAY_DRAW_LIMIT;

/** 十连额外赠送抽取次数（不计入额度权重） */
const BATCH_DRAW_BONUS_OPS = 2;

/** 十连 / 徽章抽实际执行的抽取操作次数（10+2） */
const BATCH_DRAW_TOTAL_OPS = BATCH_DRAW_QUOTA_OPS + BATCH_DRAW_BONUS_OPS;

function clampCompletedOps(completedOpsInWindow) {
  return Math.max(0, Math.min(HALF_DAY_DRAW_LIMIT, Math.floor(Number(completedOpsInWindow) || 0)));
}

/** 银两十连总价（= 旧 1～10 次单抽银两之和） */
function getBatchDrawTotalCost() {
  let total = 0;
  for (let i = 1; i <= BATCH_DRAW_QUOTA_OPS; i += 1) {
    total += getDrawCostForOperationIndex(i);
  }
  return total;
}

/** 某通道本窗是否仍可抽（权重合计为 0） */
function canChannelBatch(channelQuotaUsed) {
  return clampCompletedOps(channelQuotaUsed) === 0;
}

/** @deprecated 旧「未抽过才可十连」；现仅表示银两通道未用 */
function canBatchDraw(completedOpsInWindow) {
  return canChannelBatch(completedOpsInWindow);
}

function normalizeDrawChannel(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === DRAW_CHANNEL_BADGE) return DRAW_CHANNEL_BADGE;
  return DRAW_CHANNEL_SILVER;
}

module.exports = {
  HALF_DAY_CHANNEL_SLOT_LIMIT,
  HALF_DAY_DRAW_LIMIT,
  HALF_DAY_TOTAL_SLOTS,
  DRAW_CHANNEL_SILVER,
  DRAW_CHANNEL_BADGE,
  BADGE_BATCH_ITEM_ID,
  BADGE_BATCH_COST,
  DRAW_COST_TIERS,
  BATCH_DRAW_QUOTA_OPS,
  BATCH_DRAW_BONUS_OPS,
  BATCH_DRAW_TOTAL_OPS,
  getDrawCostForOperationIndex,
  getNextDrawCost,
  getBatchDrawTotalCost,
  canChannelBatch,
  canBatchDraw,
  normalizeDrawChannel,
};
