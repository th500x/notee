/**
 * 开仓周 ETH 周均价相对上一周的差价分布（$100 一档）
 * 规则与网页一致：≥4 BUY / ≤-4 SELL 叠仓；只统计开仓时点，不分止盈结果
 * node scripts/simulateEntryVsPrevWeek.js
 */
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const raw = JSON.parse(readFileSync(path.join(root, 'public/weeklyData.json'), 'utf8'))
const data = raw.data || raw

const weeks = Object.keys(data)
  .filter((k) => /^\d{4}-W\d{2}$/.test(k))
  .sort()
  .map((id) => ({
    id,
    rating: data[id].personalRating,
    eth: data[id].ethWeeklyAvgPrice,
  }))
  .filter((w) => typeof w.rating === 'number' && typeof w.eth === 'number')

const byId = Object.fromEntries(weeks.map((w) => [w.id, w]))

/** 与 simulationTrades 一致：开仓 + 跨年止盈，用于区分已结算 / 待结算 */
function classifyTrades(yearFilter) {
  const TP = 500
  const open = []
  const closed = []

  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i]

    for (let p = open.length - 1; p >= 0; p--) {
      const pos = open[p]
      const pnl =
        pos.direction === 'BUY' ? week.eth - pos.entry : pos.entry - week.eth
      if (pnl < TP) continue
      closed.push({ ...pos, status: 'settled', settlementWeek: week.id })
      open.splice(p, 1)
    }

    if (yearFilter != null && !week.id.startsWith(`${yearFilter}-W`)) continue
    if (week.rating < 4 && week.rating > -4) continue

    const direction = week.rating >= 4 ? 'BUY' : 'SELL'
    const prev = i > 0 ? weeks[i - 1] : null
    const vsPrev = prev ? week.eth - prev.eth : null

    open.push({
      week: week.id,
      direction,
      entry: week.eth,
      rating: week.rating,
      entryIndex: i,
      prevWeek: prev?.id ?? null,
      prevEth: prev?.eth ?? null,
      vsPrev,
      status: 'pending',
    })
  }

  for (const pos of open) closed.push(pos)
  return closed.filter((t) => t.vsPrev != null)
}

function bucketKey(diff) {
  // 每 $100 一档：… [-200,-100) [-100,0) [0,100) [100,200) …
  const floor = Math.floor(diff / 100) * 100
  return floor
}

function summarize(trades, label) {
  const buckets = new Map()
  for (const t of trades) {
    const k = bucketKey(t.vsPrev)
    if (!buckets.has(k)) {
      buckets.set(k, { settled: 0, pending: 0, buy: 0, sell: 0, samples: [] })
    }
    const b = buckets.get(k)
    if (t.status === 'settled') b.settled++
    else b.pending++
    if (t.direction === 'BUY') b.buy++
    else b.sell++
    if (b.samples.length < 3) {
      b.samples.push(
        `${t.week} ${t.direction} Δ$${Math.round(t.vsPrev)} (${t.status === 'settled' ? '已结' : '待结'})`,
      )
    }
  }

  const keys = [...buckets.keys()].sort((a, b) => a - b)
  console.log(`\n=== ${label} · 共 ${trades.length} 笔有上周可对比 ===`)
  console.log(
    ['差价区间(本周-上周)', '合计', '已结算', '待结算', 'BUY', 'SELL', '举例'].join('\t'),
  )
  for (const k of keys) {
    const b = buckets.get(k)
    const lo = k
    const hi = k + 100
    const range =
      lo >= 0 ? `[$${lo}, $${hi})` : lo === -100 ? `[-$100, $0)` : `[$${lo}, $${hi})`
    // prettier range for negatives
    const rangeLabel = `[${fmt(lo)}, ${fmt(hi)})`
    console.log(
      [
        rangeLabel,
        b.settled + b.pending,
        b.settled,
        b.pending,
        b.buy,
        b.sell,
        b.samples.join('；'),
      ].join('\t'),
    )
  }

  const diffs = trades.map((t) => t.vsPrev)
  const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const settled = trades.filter((t) => t.status === 'settled')
  const pending = trades.filter((t) => t.status === 'pending')
  console.log(
    `均差 $${avg.toFixed(1)} · 已结 ${settled.length} 均差 $${avgOf(settled)} · 待结 ${pending.length} 均差 $${avgOf(pending)}`,
  )
  console.log(
    `上涨开仓(Δ>0) ${trades.filter((t) => t.vsPrev > 0).length} · 下跌开仓(Δ<0) ${trades.filter((t) => t.vsPrev < 0).length} · 持平 ${trades.filter((t) => t.vsPrev === 0).length}`,
  )
}

function fmt(n) {
  if (n === 0) return '$0'
  return n > 0 ? `$${n}` : `-$${Math.abs(n)}`
}

function avgOf(arr) {
  if (!arr.length) return '-'
  return (arr.reduce((a, t) => a + t.vsPrev, 0) / arr.length).toFixed(1)
}

console.log('口径：开仓周 ethWeeklyAvgPrice − 上一周 ethWeeklyAvgPrice；区间左闭右开，每 $100')
console.log('开仓规则：评级≥4 BUY / ≤-4 SELL；结算：止盈$500（可跨年），用于区分已结/待结')

summarize(classifyTrades(null), '全量（2025+2026 所有开仓）')
summarize(classifyTrades(2025), '仅 2025 年开仓')
summarize(classifyTrades(2026), '仅 2026 年开仓')

// 分已结算 / 待结算单独表（全量）
const all = classifyTrades(null)
summarize(
  all.filter((t) => t.status === 'settled'),
  '全量 · 仅已结算',
)
summarize(
  all.filter((t) => t.status === 'pending'),
  '全量 · 仅待结算',
)
