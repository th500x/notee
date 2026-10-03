/** 与 00 `ethSubscribe.js` 对齐的订阅方案常量 */

export const ETH_NOTIFY_PLAN = {
  PLAN_A: 'plan_a',
  PLAN_B: 'plan_b',
  DEFAULT: 'plan_b',
}

export const ETH_SIGNAL_SOURCE = {
  MA: 'ma',
  WEEK: 'week',
}

export const ETH_NOTIFY_PLAN_OPTIONS = [
  {
    value: ETH_NOTIFY_PLAN.PLAN_A,
    label: 'Plan A（均线+指标）',
    hint: '金叉/死叉 + 周评级进入看多/看空（非中性）',
  },
  {
    value: ETH_NOTIFY_PLAN.PLAN_B,
    label: 'Plan B（均线+必荐）',
    hint: '金叉/死叉 + 仅「必」「荐」周',
  },
]
