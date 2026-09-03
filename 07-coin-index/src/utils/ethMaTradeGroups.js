/**
 * 已记操作按本地年 / 月分组，供折叠列表使用。
 */

function signalDate(trade) {
  const ms = Number(trade?.signalOpenTime) || Date.parse(trade?.signal?.at || '')
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? null : date
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
    .map(([year, months]) => ({
      year,
      months: [...months.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([month, items]) => ({ year, month, trades: items })),
    }))
}

export function isCurrentYearMonth(year, month, now = new Date()) {
  return year === now.getFullYear() && month === now.getMonth() + 1
}
