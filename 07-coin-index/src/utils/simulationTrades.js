/**
 * 模拟演练成交生成（网页 SimulationTable / YearSummary 共用）
 *
 * 开仓：个人评级 ≥ BUY_THRESHOLD → BUY；≤ SELL_THRESHOLD → SELL（每次信号一仓，可同向叠仓）
 * 平仓：止盈方向价差 ≥ TAKE_PROFIT_USD（按周 ethWeeklyAvgPrice）；不因反向信号结算
 */
import { TRADING_SIGNALS } from '../constants'

/**
 * @param {Record<string, object>} weeklyData 全量或当年周数据
 * @param {number} selectedYear
 * @returns {Array<object>}
 */
export function generateSimulationTrades(weeklyData, selectedYear) {
  const takeProfitUsd = TRADING_SIGNALS.TAKE_PROFIT_USD
  const weeks = Object.keys(weeklyData)
    .filter((key) => key.startsWith(`${selectedYear}-W`))
    .sort()

  const results = []
  /** @type {{ week: string, direction: string, ethPrice: number, rating: number, index: number }[]} */
  const openPositions = []

  for (let i = 0; i < weeks.length; i++) {
    const weekId = weeks[i]
    const weekData = weeklyData[weekId]
    if (!weekData) continue

    const rating = weekData.personalRating
    const ethPrice = weekData.ethWeeklyAvgPrice
    if (rating === undefined || rating === null || !ethPrice) continue

    // 先按本周价格检查已开仓是否触及止盈
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

    const isBuySignal = rating >= TRADING_SIGNALS.BUY_THRESHOLD
    const isSellSignal = rating <= TRADING_SIGNALS.SELL_THRESHOLD
    if (!isBuySignal && !isSellSignal) continue

    const direction = isBuySignal ? 'BUY' : 'SELL'
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

  return results
}
