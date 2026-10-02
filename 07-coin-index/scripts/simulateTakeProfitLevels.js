/**
 * 止盈档位模拟（只读、不写入网页）
 * 开仓与 SimulationTable 相同：评级 ≥4 BUY / ≤-4 SELL，每次信号都开一仓（可同向叠仓）
 * 结算改为：止盈方向价差 ≥ 档位的最早一周；不因反向信号结算
 *
 * node scripts/simulateTakeProfitLevels.js
 */
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const raw = JSON.parse(readFileSync(path.join(root, 'public/weeklyData.json'), 'utf8'))
const data = raw.data || raw

const weeks = Object.keys(data)
  .filter((k) => k.startsWith('2025-W') || k.startsWith('2026-W'))
  .sort()
  .map((id) => ({
    id,
    rating: data[id].personalRating,
    eth: data[id].ethWeeklyAvgPrice,
  }))
  .filter((w) => typeof w.rating === 'number' && typeof w.eth === 'number')

const LEVELS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]

function unrealized(direction, entry, price) {
  return direction === 'BUY' ? price - entry : entry - price
}

function summarize(trades, threshold) {
  const settled = trades.filter((t) => t.status === 'settled')
  const pending = trades.filter((t) => t.status === 'pending')
  const profits = settled.map((t) => t.profit)
  const holds = settled.map((t) => t.holdingWeeks)
  const sum = (arr) => arr.reduce((a, b) => a + b, 0)
  const avg = (arr) => (arr.length ? sum(arr) / arr.length : null)
  return {
    threshold,
    opened: trades.length,
    settled: settled.length,
    pending: pending.length,
    totalProfit: sum(profits),
    avgProfit: avg(profits),
    avgHold: avg(holds),
    minHold: holds.length ? Math.min(...holds) : null,
    maxHold: holds.length ? Math.max(...holds) : null,
    winRate: settled.length
      ? (settled.filter((t) => t.profit > 0).length / settled.length) * 100
      : null,
    pendingDetail: pending,
  }
}

/** 与网页一致：每次信号开仓；平仓仅看止盈 */
function runStackingTp(threshold) {
  const open = []
  const closed = []

  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i]

    for (const pos of [...open]) {
      const pnl = unrealized(pos.direction, pos.entry, week.eth)
      if (pnl >= threshold) {
        pos.settlementWeek = week.id
        pos.holdingWeeks = i - pos.entryIndex
        pos.profit = Math.round(pnl)
        pos.status = 'settled'
        closed.push(pos)
        open.splice(open.indexOf(pos), 1)
      }
    }

    const isBuy = week.rating >= 4
    const isSell = week.rating <= -4
    if (!isBuy && !isSell) continue

    open.push({
      week: week.id,
      direction: isBuy ? 'BUY' : 'SELL',
      rating: week.rating,
      entry: week.eth,
      entryIndex: i,
      status: 'pending',
    })
  }

  const last = weeks.at(-1)
  for (const pos of open) {
    pos.holdingWeeks = weeks.length - 1 - pos.entryIndex
    pos.profit = Math.round(unrealized(pos.direction, pos.entry, last.eth))
    closed.push(pos)
  }

  return summarize(closed, threshold)
}

/** 单仓：持仓中忽略新信号，平仓后再开 */
function runSingleTp(threshold) {
  const trades = []
  let open = null

  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i]

    if (open) {
      const pnl = unrealized(open.direction, open.entry, week.eth)
      if (pnl >= threshold) {
        open.settlementWeek = week.id
        open.holdingWeeks = i - open.entryIndex
        open.profit = Math.round(pnl)
        open.status = 'settled'
        trades.push(open)
        open = null
      }
    }

    const isBuy = week.rating >= 4
    const isSell = week.rating <= -4
    if (!isBuy && !isSell) continue
    if (open) continue

    open = {
      week: week.id,
      direction: isBuy ? 'BUY' : 'SELL',
      rating: week.rating,
      entry: week.eth,
      entryIndex: i,
      status: 'pending',
    }
  }

  if (open) {
    open.holdingWeeks = weeks.length - 1 - open.entryIndex
    open.profit = Math.round(unrealized(open.direction, open.entry, weeks.at(-1).eth))
    trades.push(open)
  }

  return summarize(trades, threshold)
}

/** 现行：反向信号结算（叠仓） */
function runOpposite() {
  const results = []
  let pending = []
  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i]
    const isBuy = week.rating >= 4
    const isSell = week.rating <= -4
    if (!isBuy && !isSell) continue
    const direction = isBuy ? 'BUY' : 'SELL'
    const opposite = pending.filter(
      (p) => (p.direction === 'BUY' && isSell) || (p.direction === 'SELL' && isBuy),
    )
    if (opposite.length) {
      for (const record of results) {
        if (record.direction !== direction && record.status === 'pending') {
          const idx = weeks.findIndex((w) => w.id === record.week)
          record.holdingWeeks = i - idx
          record.profit = Math.round(
            record.direction === 'BUY' ? week.eth - record.entry : record.entry - week.eth,
          )
          record.status = 'settled'
        }
      }
      pending = pending.filter((p) => !opposite.some((o) => o.direction === p.direction))
    }
    const rec = { week: week.id, direction, entry: week.eth, status: 'pending' }
    results.push(rec)
    pending.push(rec)
  }
  const settled = results.filter((t) => t.status === 'settled')
  return {
    opened: results.length,
    settled: settled.length,
    pending: results.length - settled.length,
    totalProfit: settled.reduce((a, t) => a + t.profit, 0),
    avgHold:
      settled.length === 0
        ? null
        : settled.reduce((a, t) => a + t.holdingWeeks, 0) / settled.length,
  }
}

function printTable(title, rows) {
  console.log(`\n=== ${title} ===`)
  console.log(
    ['止盈$', '开仓', '已结', '未平', '总利润$', '均利润$', '均持仓周', '最短', '最长', '胜率%'].join(
      '\t',
    ),
  )
  for (const r of rows) {
    console.log(
      [
        r.threshold,
        r.opened,
        r.settled,
        r.pending,
        r.totalProfit,
        r.avgProfit == null ? '-' : Math.round(r.avgProfit),
        r.avgHold == null ? '-' : r.avgHold.toFixed(1),
        r.minHold ?? '-',
        r.maxHold ?? '-',
        r.winRate == null ? '-' : Math.round(r.winRate),
      ].join('\t'),
    )
  }
}

console.log(`数据: ${weeks.length} 周（${weeks[0].id} → ${weeks.at(-1).id}）`)
console.log('价格: ethWeeklyAvgPrice；利润单位 USD/ETH（与网页模拟演练一致）')

printTable('A · 与网页一致叠仓 + 止盈平仓（推荐对照）', LEVELS.map(runStackingTp))
printTable('B · 单仓（持仓中不新开）+ 止盈平仓', LEVELS.map(runSingleTp))

const opp = runOpposite()
console.log('\n=== 对照 · 现行网页规则（反向信号结算、叠仓）===')
console.log(
  `开仓 ${opp.opened} · 已结算 ${opp.settled} · 未平 ${opp.pending} · 已结总利润 $${opp.totalProfit} · 均持仓 ${opp.avgHold?.toFixed(1) ?? '-'} 周`,
)

const a100 = runStackingTp(100)
const a1000 = runStackingTp(1000)
console.log('\n未平仓举例（叠仓止盈）:')
for (const r of [a100, a1000]) {
  if (!r.pendingDetail.length) continue
  console.log(
    `$${r.threshold}:`,
    r.pendingDetail
      .slice(0, 5)
      .map((t) => `${t.week} ${t.direction} 入$${Math.round(t.entry)} 浮盈$${t.profit}`)
      .join('；') + (r.pendingDetail.length > 5 ? ` …共${r.pendingDetail.length}笔` : ''),
  )
}
