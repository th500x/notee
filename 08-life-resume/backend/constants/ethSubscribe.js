/**
 * ETH 订阅方案（与 07 UI Plan A / Plan B 对应）。
 * 默认 plan_b；均线推送两种方案都保留。
 */

const ETH_NOTIFY_PLAN = {
  PLAN_A: 'plan_a',
  PLAN_B: 'plan_b',
  DEFAULT: 'plan_b',
};

const ETH_SIGNAL_SOURCE = {
  MA: 'ma',
  WEEK: 'week',
};

const ETH_WEEK_BIAS = {
  LONG: 'long',
  SHORT: 'short',
  NEUTRAL: 'neutral',
};

function normalizeNotifyPlan(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === ETH_NOTIFY_PLAN.PLAN_A || raw === 'a' || raw === 'ma_rating') {
    return ETH_NOTIFY_PLAN.PLAN_A;
  }
  if (raw === ETH_NOTIFY_PLAN.PLAN_B || raw === 'b' || raw === 'ma_badge') {
    return ETH_NOTIFY_PLAN.PLAN_B;
  }
  return null;
}

function planMatchesWeekSignal(plan, signal) {
  if (!signal) return false;
  if (plan === ETH_NOTIFY_PLAN.PLAN_A) {
    return signal.bias === ETH_WEEK_BIAS.LONG || signal.bias === ETH_WEEK_BIAS.SHORT;
  }
  if (plan === ETH_NOTIFY_PLAN.PLAN_B) {
    return Boolean(signal.t0Must || signal.t1Recommend);
  }
  return false;
}

module.exports = {
  ETH_NOTIFY_PLAN,
  ETH_SIGNAL_SOURCE,
  ETH_WEEK_BIAS,
  normalizeNotifyPlan,
  planMatchesWeekSignal,
};
