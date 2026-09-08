/**
 * 已记操作按本地年 / 月分组，供折叠列表使用。
 */

function signalDate(trade) {
  const ms = Number(trade?.signalOpenTime) || Date.parse(trade?.signal?.at || '')
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function parseClosedOnDate(closedOn) {
  if (typeof closedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(closedOn.trim())) return null
  const [year, month, day] = closedOn.trim().split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

/** 信号日到止盈/止损日的日历天数；未填平仓日或日期非法则不算。 */
export function tradeHoldDays(trade) {
  const opened = signalDate(trade)
  const closed = parseClosedOnDate(trade?.closedOn)
  if (!opened || !closed) return null
  const days = Math.round((startOfLocalDay(closed) - startOfLocalDay(opened)) / 86400000)
  if (!Number.isFinite(days) || days < 0) return null
  return days
}

/** 仅统计已填止盈/止损日期的条目；没有可统计项时返回 null。 */
export function averageHoldDays(trades) {
  const days = []
  for (const trade of Array.isArray(trades) ? trades : []) {
    const n = tradeHoldDays(trade)
    if (n != null) days.push(n)
  }
  if (!days.length) return null
  return Math.round((days.reduce((sum, n) => sum + n, 0) / days.length) * 10) / 10
}

/** 手填最终收益合计；缺字段按 0。 */
export function sumTradePnl(trades) {
  let total = 0
  for (const trade of Array.isArray(trades) ? trades : []) {
    const n = Number(trade?.pnl)
    if (Number.isFinite(n)) total += n
  }
  return Math.round(total * 100) / 100
}

export function groupTradesByYearMonth(trades) {
  const years = new Map()
  for (const trade of Array.isArray(trades) ? trades : []) {
    const date = signalDate(trade)
    if (!date) continue
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    if (!years.has(year)) years.set(year, new Map())
    const months = years.get(year)
    if (!months.has(month)) months.set(month, [])
    months.get(month).push(trade)
  }

  return [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => {
      const monthGroups = [...months.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([month, items]) => ({
          year,
          month,
          trades: items,
          pnlTotal: sumTradePnl(items),
          avgHoldDays: averageHoldDays(items),
        }))
      const yearTrades = monthGroups.flatMap((item) => item.trades)
      return {
        year,
        months: monthGroups,
        pnlTotal: sumTradePnl(yearTrades),
        avgHoldDays: averageHoldDays(yearTrades),
      }
    })
}

export function isCurrentYearMonth(year, month, now = new Date()) {
  return year === now.getFullYear() && month === now.getMonth() + 1
}
