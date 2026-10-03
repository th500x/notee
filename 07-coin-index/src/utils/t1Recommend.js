/**
 * T1「荐」综合判断
 *
 * 覆盖在个人评级之上，不计入 -16~+16。
 * 与 T0「必」互斥：该周已是必买/必卖则不荐。
 * 荐买 / 荐卖门槛不对称（短持仓路径取向，非「更强的必」）。
 */

import { T1_RECOMMEND_RULES } from '../constants/index.js'
import { computeT0MustMap } from './t0Must.js'

export const T1_RECOMMEND = {
  BUY: 'buy',
  SELL: 'sell',
  ...T1_RECOMMEND_RULES,
}

const WEEK_ID_RE = /^(\d{4})-W(\d{2})$/

function isUsableWeek(week) {
  return (
    week &&
    Number.isFinite(week.personalRating) &&
    Number.isFinite(week.fearGreedIndex) &&
    Number.isFinite(week.mayerMultiple)
  )
}

/**
 * @param {object} week
 * @param {'buy'|'sell'|null|undefined} t0Must 同周 T0；有值则直接不荐
 * @returns {'buy'|'sell'|null}
 */
export function evaluateT1Recommend(week, t0Must) {
  if (t0Must === T1_RECOMMEND.BUY || t0Must === T1_RECOMMEND.SELL) return null
  if (!isUsableWeek(week)) return null

  const rating = week.personalRating
  const fng = week.fearGreedIndex
  const mayer = week.mayerMultiple

  // 荐卖：看空信号 + Mayer 偏热
  if (rating <= T1_RECOMMEND.SELL_RATING_MAX && mayer >= T1_RECOMMEND.SELL_MAYER_MIN) {
    return T1_RECOMMEND.SELL
  }

  // 荐买：看多信号 + FNG 非至暗窗口 + Mayer 未砸穿
  if (
    rating >= T1_RECOMMEND.BUY_RATING_MIN &&
    fng >= T1_RECOMMEND.BUY_FNG_MIN &&
    fng <= T1_RECOMMEND.BUY_FNG_MAX &&
    mayer >= T1_RECOMMEND.BUY_MAYER_MIN
  ) {
    return T1_RECOMMEND.BUY
  }

  return null
}

/**
 * 按周 ID 计算全部 T1 信号（内部先算 T0 以便互斥）。
 * @param {Record<string, object>} allWeeklyData
 * @returns {Record<string, 'buy'|'sell'|null>}
 */
export function computeT1RecommendMap(allWeeklyData) {
  const t0Map = computeT0MustMap(allWeeklyData)
  const result = {}

  for (const [weekId, week] of Object.entries(allWeeklyData || {})) {
    if (!WEEK_ID_RE.test(weekId)) continue
    result[weekId] = evaluateT1Recommend(week, t0Map[weekId] ?? null)
  }
  return result
}

/** 把 t1Recommend 写回周记录（脚本用） */
export function applyT1RecommendToData(allWeeklyData) {
  const signals = computeT1RecommendMap(allWeeklyData)
  for (const [weekId, week] of Object.entries(allWeeklyData || {})) {
    if (!WEEK_ID_RE.test(weekId) || !week || typeof week !== 'object') continue
    week.t1Recommend = signals[weekId] ?? null
  }
  return signals
}
