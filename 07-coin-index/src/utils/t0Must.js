/**
 * T0「必」综合判断
 *
 * 覆盖在个人评级之上，不计入 -16~+16。
 * 必买 / 必卖均为三道门同时满足（对称）。
 */

import { RATING_LEVELS, T0_MUST_RULES } from '../constants/index.js'

export const T0_MUST = {
  BUY: 'buy',
  SELL: 'sell',
  ...T0_MUST_RULES,
}

const WEEK_ID_RE = /^(\d{4})-W(\d{2})$/

export function weekSortKey(weekId) {
  const match = typeof weekId === 'string' ? weekId.match(WEEK_ID_RE) : null
  if (!match) return 0
  return Number(match[1]) * 100 + Number(match[2])
}

function mean(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function sampleStdev(values) {
  if (values.length < 2) return null
  const avg = mean(values)
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function zScore(value, values) {
  const avg = mean(values)
  const stdev = sampleStdev(values)
  if (avg == null || stdev == null || stdev === 0) return null
  return (value - avg) / stdev
}

/** 当前值在样本中的百分位（0=最便宜，100=最贵） */
export function percentileRank(value, values) {
  if (!values.length) return null
  const below = values.filter((item) => item < value).length
  const equal = values.filter((item) => item === value).length
  return ((below + 0.5 * equal) / values.length) * 100
}

function countScores(scores, target) {
  if (!scores || typeof scores !== 'object') return 0
  return Object.values(scores).filter((score) => score === target).length
}

function sameSide(rating, side) {
  if (rating == null || Number.isNaN(rating)) return false
  if (side === T0_MUST.BUY) return rating >= RATING_LEVELS.BULLISH
  if (side === T0_MUST.SELL) return rating <= RATING_LEVELS.BEARISH
  return false
}

function isUsableWeek(week) {
  return (
    week &&
    Number.isFinite(week.personalRating) &&
    Number.isFinite(week.btcWeeklyAvgPrice) &&
    Number.isFinite(week.ethWeeklyAvgPrice)
  )
}

function priceTailPass(side, btc, eth, refBtc, refEth) {
  const btcRank = percentileRank(btc, refBtc)
  const ethRank = percentileRank(eth, refEth)
  const btcZ = zScore(btc, refBtc)
  const ethZ = zScore(eth, refEth)

  if (side === T0_MUST.BUY) {
    const inCheapest =
      btcRank != null &&
      ethRank != null &&
      btcRank <= T0_MUST.TAIL_PERCENT &&
      ethRank <= T0_MUST.TAIL_PERCENT
    const cheapZ =
      btcZ != null &&
      ethZ != null &&
      btcZ <= -T0_MUST.Z_THRESHOLD &&
      ethZ <= -T0_MUST.Z_THRESHOLD
    return inCheapest || cheapZ
  }

  const inRichest =
    btcRank != null &&
    ethRank != null &&
    btcRank >= 100 - T0_MUST.TAIL_PERCENT &&
    ethRank >= 100 - T0_MUST.TAIL_PERCENT
  const richZ =
    btcZ != null &&
    ethZ != null &&
    btcZ >= T0_MUST.Z_THRESHOLD &&
    ethZ >= T0_MUST.Z_THRESHOLD
  return inRichest || richZ
}

function evaluateWeek(week, priorWeeks) {
  const rating = week.personalRating
  const scores = week.indicatorScores || {}

  if (rating >= RATING_LEVELS.EXTREME_BULLISH) {
    if (countScores(scores, 2) < T0_MUST.MIN_EXTREME_SCORE_COUNT) return null
    const refs = priorWeeks.filter((item) => sameSide(item.personalRating, T0_MUST.BUY))
    if (refs.length < T0_MUST.MIN_SAME_SIDE_SAMPLE) return null
    const pass = priceTailPass(
      T0_MUST.BUY,
      week.btcWeeklyAvgPrice,
      week.ethWeeklyAvgPrice,
      refs.map((item) => item.btcWeeklyAvgPrice),
      refs.map((item) => item.ethWeeklyAvgPrice),
    )
    return pass ? T0_MUST.BUY : null
  }

  if (rating <= RATING_LEVELS.EXTREME_BEARISH) {
    if (countScores(scores, -2) < T0_MUST.MIN_EXTREME_SCORE_COUNT) return null
    const refs = priorWeeks.filter((item) => sameSide(item.personalRating, T0_MUST.SELL))
    if (refs.length < T0_MUST.MIN_SAME_SIDE_SAMPLE) return null
    const pass = priceTailPass(
      T0_MUST.SELL,
      week.btcWeeklyAvgPrice,
      week.ethWeeklyAvgPrice,
      refs.map((item) => item.btcWeeklyAvgPrice),
      refs.map((item) => item.ethWeeklyAvgPrice),
    )
    return pass ? T0_MUST.SELL : null
  }

  return null
}

/**
 * 按周 ID 计算全部 T0 信号（只看此前最多 52 周，无前视）。
 * @param {Record<string, object>} allWeeklyData
 * @returns {Record<string, 'buy'|'sell'|null>}
 */
export function computeT0MustMap(allWeeklyData) {
  const weeks = Object.entries(allWeeklyData || {})
    .filter(([weekId, week]) => WEEK_ID_RE.test(weekId) && isUsableWeek(week))
    .map(([weekId, week]) => ({ weekId, ...week }))
    .sort((a, b) => weekSortKey(a.weekId) - weekSortKey(b.weekId))

  const result = {}
  for (let i = 0; i < weeks.length; i++) {
    const prior = weeks.slice(Math.max(0, i - T0_MUST.LOOKBACK_WEEKS), i)
    result[weeks[i].weekId] = evaluateWeek(weeks[i], prior)
  }
  return result
}

/** 把 t0Must 写回周记录（脚本用） */
export function applyT0MustToData(allWeeklyData) {
  const signals = computeT0MustMap(allWeeklyData)
  for (const [weekId, week] of Object.entries(allWeeklyData || {})) {
    if (!WEEK_ID_RE.test(weekId) || !week || typeof week !== 'object') continue
    week.t0Must = signals[weekId] ?? null
  }
  return signals
}
