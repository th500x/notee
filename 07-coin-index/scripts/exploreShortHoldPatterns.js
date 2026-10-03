/**
 * 探索：止盈$500 下，短持仓 vs 长持仓/未平 的开仓特征（只读）
 * node scripts/exploreShortHoldPatterns.js
 */
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const raw = JSON.parse(readFileSync(path.join(root, 'public/weeklyData.json'), 'utf8'))
const data = raw.data || raw
const TP = 500

const weeks = Object.keys(data)
  .filter((k) => /^\d{4}-W\d{2}$/.test(k))
  .sort()
  .map((id) => {
    const w = data[id]
    return {
      id,
      rating: w.personalRating,
      eth: w.ethWeeklyAvgPrice,
      btcChg: w.btcWeeklyChange,
      fng: w.fearGreedIndex,
      mayer: w.mayerMultiple,
      ahr: w.ahr999,
      four: w.btcFourYearIndex,
      fed: w.fedRate,
      boj: w.bojRate,
      ethBtc: w.ethBtcRatio,
      t0: w.t0Must,
    }
  })
  .filter((w) => typeof w.rating === 'number' && typeof w.eth === 'number')

function buildTrades() {
  const open = []
  const closed = []
  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i]
    for (let p = open.length - 1; p >= 0; p--) {
      const pos = open[p]
      const pnl = pos.direction === 'BUY' ? week.eth - pos.entry : pos.entry - week.eth
      if (pnl < TP) continue
      closed.push({
        ...pos,
        status: 'settled',
        hold: i - pos.i,
        exitEth: week.eth,
        exitWeek: week.id,
        profit: Math.round(pnl),
      })
      open.splice(p, 1)
    }
    if (week.rating < 4 && week.rating > -4) continue
    const direction = week.rating >= 4 ? 'BUY' : 'SELL'
    const prev = i > 0 ? weeks[i - 1] : null
    open.push({
      week: week.id,
      direction,
      entry: week.eth,
      i,
      rating: week.rating,
      vsPrev: prev ? week.eth - prev.eth : null,
      btcChg: week.btcChg,
      fng: week.fng,
      mayer: week.mayer,
      ahr: week.ahr,
      four: week.four,
      t0: week.t0,
      ethBtc: week.ethBtc,
    })
  }
  for (const pos of open) {
    closed.push({
      ...pos,
      status: 'pending',
      hold: weeks.length - 1 - pos.i,
      profit: Math.round(
        pos.direction === 'BUY'
          ? weeks.at(-1).eth - pos.entry
          : pos.entry - weeks.at(-1).eth,
      ),
    })
  }
  return closed
}

const trades = buildTrades()
const settled = trades.filter((t) => t.status === 'settled')
const pending = trades.filter((t) => t.status === 'pending')

function avg(arr, fn) {
  const xs = arr.map(fn).filter((v) => typeof v === 'number' && !Number.isNaN(v))
  if (!xs.length) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function pct(n, d) {
  return d ? ((n / d) * 100).toFixed(0) + '%' : '-'
}

// 持仓分档
const SHORT = settled.filter((t) => t.hold <= 4)
const MID = settled.filter((t) => t.hold >= 5 && t.hold <= 12)
const LONG = settled.filter((t) => t.hold >= 13)

console.log('=== 持仓周数分布（已结算）===')
const holdBuckets = new Map()
for (const t of settled) {
  const k = t.hold <= 2 ? '1-2周' : t.hold <= 4 ? '3-4周' : t.hold <= 8 ? '5-8周' : t.hold <= 16 ? '9-16周' : '17+周'
  holdBuckets.set(k, (holdBuckets.get(k) || 0) + 1)
}
for (const k of ['1-2周', '3-4周', '5-8周', '9-16周', '17+周']) {
  console.log(k, holdBuckets.get(k) || 0, pct(holdBuckets.get(k) || 0, settled.length))
}
console.log(
  '已结均持仓',
  avg(settled, (t) => t.hold)?.toFixed(1),
  '· ≤4周',
  SHORT.length,
  pct(SHORT.length, settled.length),
  '· 待结',
  pending.length,
)

function profile(label, arr) {
  if (!arr.length) {
    console.log(`\n${label}: 无`)
    return
  }
  const buy = arr.filter((t) => t.direction === 'BUY').length
  console.log(`\n=== ${label} n=${arr.length} ===`)
  console.log(
    `BUY ${buy} / SELL ${arr.length - buy} · 均评级 ${avg(arr, (t) => t.rating)?.toFixed(1)} · 均|评级| ${avg(arr, (t) => Math.abs(t.rating))?.toFixed(1)}`,
  )
  console.log(
    `均Δ上周 $${avg(arr, (t) => t.vsPrev)?.toFixed(0)} · 均BTC周涨跌 ${avg(arr, (t) => t.btcChg)?.toFixed(1)}% · 均FNG ${avg(arr, (t) => t.fng)?.toFixed(0)} · 均Mayer ${avg(arr, (t) => t.mayer)?.toFixed(2)} · 均Ahr ${avg(arr, (t) => t.ahr)?.toFixed(2)} · 均四年 ${avg(arr, (t) => t.four)?.toFixed(2)}`,
  )
  console.log(
    `评级≥8 ${arr.filter((t) => t.rating >= 8).length} · ≤-6 ${arr.filter((t) => t.rating <= -6).length} · |评级|≥6 ${arr.filter((t) => Math.abs(t.rating) >= 6).length} · t0Must=${arr.filter((t) => t.t0).length}`,
  )
}

profile('短持仓≤4周（已结）', SHORT)
profile('中持仓5-12周（已结）', MID)
profile('长持仓≥13周（已结）', LONG)
profile('待结算', pending)

// 方向×短持仓
console.log('\n=== 方向 × 持仓 ===')
for (const dir of ['BUY', 'SELL']) {
  const s = settled.filter((t) => t.direction === dir)
  const short = s.filter((t) => t.hold <= 4).length
  console.log(
    dir,
    '已结',
    s.length,
    '≤4周',
    short,
    pct(short, s.length),
    '均持仓',
    avg(s, (t) => t.hold)?.toFixed(1),
    '待结',
    pending.filter((t) => t.direction === dir).length,
  )
}

// 简单规则命中率：在开仓信号里，若满足条件，后续是否≤4周平仓
function ruleHit(name, pred) {
  const candidates = trades.filter((t) => pred(t))
  const shortOk = candidates.filter((t) => t.status === 'settled' && t.hold <= 4)
  const settledOk = candidates.filter((t) => t.status === 'settled')
  const pend = candidates.filter((t) => t.status === 'pending')
  const long = settledOk.filter((t) => t.hold > 4)
  console.log(
    name,
    `命中开仓 ${candidates.length} · ≤4周平 ${shortOk.length}(${pct(shortOk.length, candidates.length)}) · 已结但>4周 ${long.length} · 待结 ${pend.length} · 已结均持仓 ${avg(settledOk, (t) => t.hold)?.toFixed(1) ?? '-'}`,
  )
}

console.log('\n=== 候选「荐」规则（开仓当周特征 → ≤4周止盈占比）===')
ruleHit('A 现行信号(对照)', () => true)
ruleHit('B |评级|≥6', (t) => Math.abs(t.rating) >= 6)
ruleHit('C |评级|≥8', (t) => Math.abs(t.rating) >= 8)
ruleHit('D 评级≥8 BUY', (t) => t.rating >= 8)
ruleHit('E 评级≤-6 SELL', (t) => t.rating <= -6)
ruleHit('F FNG≤25 且 BUY', (t) => t.direction === 'BUY' && t.fng <= 25)
ruleHit('G FNG≥75 且 SELL', (t) => t.direction === 'SELL' && t.fng >= 75)
ruleHit('H Mayer≤0.8 且 BUY', (t) => t.direction === 'BUY' && t.mayer <= 0.8)
ruleHit('I Mayer≥1.5 且 SELL', (t) => t.direction === 'SELL' && t.mayer >= 1.5)
ruleHit('J Ahr≤0.45 且 BUY', (t) => t.direction === 'BUY' && t.ahr <= 0.45)
ruleHit('K |Δ上周|≥200', (t) => Math.abs(t.vsPrev) >= 200)
ruleHit('L 顺势: BUY且Δ上周<0 或 SELL且Δ上周>0', (t) =>
  t.direction === 'BUY' ? t.vsPrev < 0 : t.vsPrev > 0,
)
ruleHit('M 逆势: BUY且Δ上周>0 或 SELL且Δ上周<0', (t) =>
  t.direction === 'BUY' ? t.vsPrev > 0 : t.vsPrev < 0,
)
ruleHit('N |评级|≥6 且 顺势', (t) =>
  Math.abs(t.rating) >= 6 && (t.direction === 'BUY' ? t.vsPrev < 0 : t.vsPrev > 0),
)
ruleHit('O BTC周跌≤-10% 且 BUY', (t) => t.direction === 'BUY' && t.btcChg <= -10)
ruleHit('P BTC周涨≥10% 且 SELL', (t) => t.direction === 'SELL' && t.btcChg >= 10)
ruleHit('Q |评级|≥6 且 (FNG极端或Mayer极端)', (t) => {
  if (Math.abs(t.rating) < 6) return false
  if (t.direction === 'BUY') return t.fng <= 30 || t.mayer <= 0.9
  return t.fng >= 70 || t.mayer >= 1.4
})

// 短持仓样本列表
console.log('\n=== 短持仓≤4周明细 ===')
for (const t of SHORT.sort((a, b) => a.hold - b.hold)) {
  console.log(
    t.week,
    t.direction,
    `评级${t.rating}`,
    `持${t.hold}周`,
    `→${t.exitWeek}`,
    `盈$${t.profit}`,
    `FNG${t.fng?.toFixed?.(0) ?? t.fng}`,
    `Mayer${t.mayer?.toFixed?.(2) ?? t.mayer}`,
    `Δ周$${Math.round(t.vsPrev ?? 0)}`,
  )
}
