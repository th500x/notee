/**
 * 模拟演练成交生成（网页 SimulationTable / YearSummary 共用）
 *
 * 指标方案：个人评级 ≥ BUY_THRESHOLD → BUY；≤ SELL_THRESHOLD → SELL
 * 「必」「荐」方案：当周必买/荐买 → BUY，必卖/荐卖 → SELL（有必不看荐）
 * 每次 1 ETH。平仓：止盈方向价差 ≥ TAKE_PROFIT_USD；不因反向信号结算
 * 展示：只列出 selectedYear 开的仓；平仓可看后续年份的周数据（跨年止盈）
 *
 * 保证金安全线：只看当年各周收盘后的持仓。取开仓笔数最多的一周（同样重则取所需保证金更高的一周）。
 * 多空在同一账户对冲：跌到 LONG_STRESS_USD 与涨到 SHORT_STRESS_USD 各自的净亏损，取较大者。
 */
import { TRADING_SIGNALS } from '../constants'
import { computeT0MustMap } from './t0Must.js'
import { computeT1RecommendMap } from './t1Recommend.js'

export const SIM_PLAN = {
  INDICATOR: 'indicator',
  BADGE: 'badge',
}

export const MARGIN_STRESS = {
  LONG_USD: 1000,
  SHORT_USD: 5000,
}

function bookPnlAt(positions, price) {
  let pnl = 0
  for (const pos of positions) {
    pnl += pos.direction === 'BUY' ? price - pos.ethPrice : pos.ethPrice - price
  }
  return pnl
}

function safetyMargin(positions) {
  const dropLoss = Math.max(0, -bookPnlAt(positions, MARGIN_STRESS.LONG_USD))
  const riseLoss = Math.max(0, -bookPnlAt(positions, MARGIN_STRESS.SHORT_USD))
  return Math.max(dropLoss, riseLoss)
}

function resolveDirection(plan, weekId, rating, t0Map, t1Map) {
  if (plan === SIM_PLAN.BADGE) {
    const badge = t0Map[weekId] || t1Map[weekId] || null
    if (badge === 'buy') return 'BUY'
    if (badge === 'sell') return 'SELL'
    return null
  }
  if (rating >= TRADING_SIGNALS.BUY_THRESHOLD) return 'BUY'
  if (rating <= TRADING_SIGNALS.SELL_THRESHOLD) return 'SELL'
  return null
}

/**
 * @param {Record<string, object>} weeklyData
 * @param {number} selectedYear
 * @param {'indicator'|'badge'} [plan]
 * @returns {{ trades: Array<object>, marginSafety: number, marginWeekId: string|null }}
 */
export function runYearSimulation(weeklyData, selectedYear, plan = SIM_PLAN.INDICATOR) {
  const takeProfitUsd = TRADING_SIGNALS.TAKE_PROFIT_USD
  const yearPrefix = `${selectedYear}-W`
  const useBadge = plan === SIM_PLAN.BADGE
  const t0Map = useBadge ? computeT0MustMap(weeklyData) : null
  const t1Map = useBadge ? computeT1RecommendMap(weeklyData) : null

  const weeks = Object.keys(weeklyData)
    .filter((key) => /^\d{4}-W\d{2}$/.test(key))
    .sort()

  const results = []
  /** @type {{ week: string, direction: string, ethPrice: number, rating: number, index: number }[]} */
  const openPositions = []
  let heaviest = { count: -1, safety: 0, weekId: null }

  for (let i = 0; i < weeks.length; i++) {
    const weekId = weeks[i]
    const weekData = weeklyData[weekId]
    if (!weekData) continue

    const rating = weekData.personalRating
    const ethPrice = weekData.ethWeeklyAvgPrice
    if (rating === undefined || rating === null || !ethPrice) continue

    for (let p = openPositions.length - 1; p >= 0; p--) {
      const pos = openPositions[p]
      const pnl =
        pos.direction === 'BUY' ? ethPrice - pos.ethPrice : pos.ethPrice - ethPrice
      if (pnl < takeProfitUsd) continue

      const record = results.find((r) => r.week === pos.week && r.status === 'pending')
      if (record) {
        record.settlementWeek = weekId
        record.settlementPrice = Math.round(ethPrice)
        record.holdingWeeks = i - pos.index
        record.profit = Math.round(pnl)
        record.status = 'settled'
      }
      openPositions.splice(p, 1)
    }

    if (!weekId.startsWith(yearPrefix)) continue

    const direction = resolveDirection(plan, weekId, rating, t0Map, t1Map)
    if (direction) {
      results.push({
        week: weekId,
        rating,
        direction,
        ethPrice: Math.round(ethPrice),
        settlementWeek: 'TBD',
        settlementPrice: 'TBD',
        holdingWeeks: 'TBD',
        profit: 'TBD',
        status: 'pending',
      })
      openPositions.push({
        week: weekId,
        direction,
        ethPrice,
        rating,
        index: i,
      })
    }

    const count = openPositions.length
    const safety = safetyMargin(openPositions)
    if (count > heaviest.count || (count === heaviest.count && count > 0 && safety > heaviest.safety)) {
      heaviest = { count, safety, weekId }
    }
  }

  return {
    trades: results,
    marginSafety: heaviest.count > 0 ? Math.round(heaviest.safety) : 0,
    marginWeekId: heaviest.weekId,
  }
}

export function generateSimulationTrades(weeklyData, selectedYear, plan = SIM_PLAN.INDICATOR) {
  return runYearSimulation(weeklyData, selectedYear, plan).trades
}
