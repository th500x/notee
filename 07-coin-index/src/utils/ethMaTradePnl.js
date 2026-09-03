/**
 * 操作记录参考收益：方向 ×（出场价 − 买入价）× 数量。
 * 与 11 `services/ethMaCross/tradePnl.js` 同算法；最终收益仍以手填为准。
 */

export function crossDirection(cross) {
  if (cross === 'golden') return 1
  if (cross === 'death') return -1
  return null
}

export function roundPnl(value) {
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function isPresentNumber(value) {
  if (value == null || value === '') return false
  return Number.isFinite(Number(value))
}

export function suggestTradePnl({ cross, entryPrice, exitPrice, quantity }) {
  const direction = crossDirection(cross)
  if (direction == null) return null
  if (!isPresentNumber(entryPrice) || !isPresentNumber(exitPrice) || !isPresentNumber(quantity)) {
    return null
  }
  const entry = Number(entryPrice)
  const exit = Number(exitPrice)
  const qty = Number(quantity)
  return roundPnl(direction * (exit - entry) * qty)
}
