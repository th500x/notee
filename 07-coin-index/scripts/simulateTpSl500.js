/**
 * 只读模拟：止盈 $500 + 止损 $500（不写入网页）
 * node scripts/simulateTpSl500.js
 */
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const raw = JSON.parse(readFileSync(path.join(root, 'public/weeklyData.json'), 'utf8'))
const data = raw.data || raw
const TP = 500
const SL = 500

const weeks = Object.keys(data)
  .filter((k) => /^\d{4}-W\d{2}$/.test(k))
  .sort()
  .map((id) => ({
    id,
    rating: data[id].personalRating,
    eth: data[id].ethWeeklyAvgPrice,
  }))
  .filter((w) => typeof w.rating === 'number' && typeof w.eth === 'number')

function unrealized(direction, entry, price) {
  return direction === 'BUY' ? price - entry : entry - price
}

/** 叠仓；每周先检查止盈/止损，再按信号开仓。yearFilter: null=全量开仓；数字=只开该年，平仓可跨年 */
function run(yearFilter) {
  const open = []
  const closed = []

  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i]

    for (let p = open.length - 1; p >= 0; p--) {
      const pos = open[p]
      const pnl = unrealized(pos.direction, pos.entry, week.eth)
      let reason = null
      if (pnl >= TP) reason = 'tp'
      else if (pnl <= -SL) reason = 'sl'
      if (!reason) continue

      closed.push({
        week: pos.week,
        direction: pos.direction,
        entry: pos.entry,
        settlementWeek: week.id,
        settlementPrice: week.eth,
        holdingWeeks: i - pos.entryIndex,
        profit: Math.round(pnl),
        reason,
      })
      open.splice(p, 1)
    }

    if (yearFilter != null && !week.id.startsWith(`${yearFilter}-W`)) continue

    const isBuy = week.rating >= 4
    const isSell = week.rating <= -4
    if (!isBuy && !isSell) continue

    open.push({
      week: week.id,
      direction: isBuy ? 'BUY' : 'SELL',
      entry: week.eth,
      entryIndex: i,
    })
  }

  const last = weeks.at(-1)
  for (const pos of open) {
    closed.push({
      week: pos.week,
      direction: pos.direction,
      entry: pos.entry,
      settlementWeek: 'TBD',
      holdingWeeks: weeks.length - 1 - pos.entryIndex,
      profit: Math.round(unrealized(pos.direction, pos.entry, last.eth)),
      reason: 'pending',
    })
  }

  const settled = closed.filter((t) => t.reason === 'tp' || t.reason === 'sl')
  const wins = settled.filter((t) => t.reason === 'tp')
  const losses = settled.filter((t) => t.reason === 'sl')
  const pending = closed.filter((t) => t.reason === 'pending')
  const sum = (arr, key = 'profit') => arr.reduce((a, t) => a + t[key], 0)

  return {
    opened: closed.length,
    settled: settled.length,
    tp: wins.length,
    sl: losses.length,
    pending: pending.length,
    winProfit: sum(wins),
    lossProfit: sum(losses),
    settledPnl: sum(settled),
    avgHold:
      settled.length === 0
        ? null
        : settled.reduce((a, t) => a + t.holdingWeeks, 0) / settled.length,
    maxWin: wins.length ? Math.max(...wins.map((t) => t.profit)) : 0,
    maxLoss: losses.length ? Math.min(...losses.map((t) => t.profit)) : 0,
    winRate: settled.length ? (wins.length / settled.length) * 100 : null,
  }
}

console.log(`数据 ${weeks[0].id} → ${weeks.at(-1).id}；止盈 $${TP} / 止损 $${SL}；叠仓；周均价判定（可跳空）\n`)

function print(label, r) {
  console.log(`=== ${label} ===`)
  console.log(
    `开仓 ${r.opened} · 已结 ${r.settled}（止盈 ${r.tp} / 止损 ${r.sl}）· 未平 ${r.pending}`,
  )
  console.log(
    `已结总盈亏 $${r.settledPnl}（盈利合计 $${r.winProfit} · 亏损合计 $${r.lossProfit}）`,
  )
  console.log(
    `胜率 ${r.winRate == null ? '-' : r.winRate.toFixed(1) + '%'} · 均持仓 ${r.avgHold?.toFixed(1) ?? '-'} 周 · 最大单笔盈 $${r.maxWin} · 最大单笔亏 $${r.maxLoss}`,
  )
  console.log('')
}

print('全量叠仓（2025+2026 一起做）', run(null))
print('仅 2025 开仓（平仓可跨年）', run(2025))
print('仅 2026 开仓（平仓可跨年）', run(2026))

// 对照：现行只止盈
function runTpOnly(yearFilter) {
  const open = []
  const closed = []
  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i]
    for (let p = open.length - 1; p >= 0; p--) {
      const pos = open[p]
      const pnl = unrealized(pos.direction, pos.entry, week.eth)
      if (pnl < TP) continue
      closed.push({ profit: Math.round(pnl), reason: 'tp' })
      open.splice(p, 1)
    }
    if (yearFilter != null && !week.id.startsWith(`${yearFilter}-W`)) continue
    if (week.rating >= 4 || week.rating <= -4) {
      open.push({
        week: week.id,
        direction: week.rating >= 4 ? 'BUY' : 'SELL',
        entry: week.eth,
        entryIndex: i,
      })
    }
  }
  const sum = closed.reduce((a, t) => a + t.profit, 0)
  console.log(
    `对照只止盈$${TP} · ${yearFilter ?? '全量'}: 已结 ${closed.length} · 总盈亏 $${sum}`,
  )
}
runTpOnly(null)
runTpOnly(2025)
runTpOnly(2026)
