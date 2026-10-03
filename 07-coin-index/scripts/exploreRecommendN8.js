/**
 * 「荐」探索：成功 = 开仓后 ≤8 周触及止盈 $500（只读）
 * node scripts/exploreRecommendN8.js
 */
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const raw = JSON.parse(readFileSync(path.join(root, 'public/weeklyData.json'), 'utf8'))
const data = raw.data || raw
const TP = 500
const N = 8

const weeks = Object.keys(data)
  .filter((k) => /^\d{4}-W\d{2}$/.test(k))
  .sort()
  .map((id) => {
    const w = data[id]
    return {
      id,
      year: Number(id.slice(0, 4)),
      rating: w.personalRating,
      eth: w.ethWeeklyAvgPrice,
      btcChg: w.btcWeeklyChange,
      fng: w.fearGreedIndex,
      mayer: w.mayerMultiple,
      ahr: w.ahr999,
      four: w.btcFourYearIndex,
      t0: w.t0Must,
      scores: w.indicatorScores,
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
      closed.push({ ...pos, status: 'settled', hold: i - pos.i, exitWeek: week.id, profit: Math.round(pnl) })
      open.splice(p, 1)
    }
    if (week.rating < 4 && week.rating > -4) continue
    const prev = i > 0 ? weeks[i - 1] : null
    // 同向连续信号第几周（1=该方向新一段）
    let streak = 1
    for (let j = i - 1; j >= 0; j--) {
      const r = weeks[j].rating
      const same =
        week.rating >= 4 ? r >= 4 : week.rating <= -4 ? r <= -4 : false
      if (!same) break
      streak++
    }
    open.push({
      week: week.id,
      year: week.year,
      direction: week.rating >= 4 ? 'BUY' : 'SELL',
      entry: week.eth,
      i,
      rating: week.rating,
      absR: Math.abs(week.rating),
      vsPrev: prev ? week.eth - prev.eth : null,
      btcChg: week.btcChg,
      fng: week.fng,
      mayer: week.mayer,
      ahr: week.ahr,
      four: week.four,
      t0: week.t0,
      streak,
      scores: week.scores,
    })
  }
  for (const pos of open) {
    closed.push({
      ...pos,
      status: 'pending',
      hold: weeks.length - 1 - pos.i,
      profit: Math.round(
        pos.direction === 'BUY' ? weeks.at(-1).eth - pos.entry : pos.entry - weeks.at(-1).eth,
      ),
    })
  }
  return closed
}

const trades = buildTrades()
const success = (t) => t.status === 'settled' && t.hold <= N
const failSettled = (t) => t.status === 'settled' && t.hold > N
const pending = (t) => t.status === 'pending'

function avg(arr, fn) {
  const xs = arr.map(fn).filter((v) => typeof v === 'number' && !Number.isNaN(v))
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(0)}%` : '-')

function evalRule(name, pred, subset = trades) {
  const hit = subset.filter(pred)
  const ok = hit.filter(success)
  const slow = hit.filter(failSettled)
  const pend = hit.filter(pending)
  const settled = hit.filter((t) => t.status === 'settled')
  return {
    name,
    n: hit.length,
    ok: ok.length,
    slow: slow.length,
    pend: pend.length,
    rate: hit.length ? ok.length / hit.length : null,
    settledRate: settled.length ? ok.length / settled.length : null,
    avgHoldSettled: avg(settled, (t) => t.hold),
    avgHoldOk: avg(ok, (t) => t.hold),
  }
}

function printRule(r, note = '') {
  console.log(
    [
      r.name.padEnd(42),
      `n=${String(r.n).padStart(2)}`,
      `≤${N}周 ${String(r.ok).padStart(2)}(${r.rate == null ? '  -' : pct(r.ok, r.n).padStart(3)})`,
      `慢平 ${r.slow}`,
      `待结 ${r.pend}`,
      `已结内短平 ${r.settledRate == null ? '-' : pct(r.ok, r.ok + r.slow)}`,
      `已结均持仓 ${r.avgHoldSettled?.toFixed(1) ?? '-'}`,
      note,
    ].join('  '),
  )
}

const base = evalRule('对照·全部信号', () => true)
console.log(`成功定义：≤${N} 周触及止盈 $${TP}；样本 ${trades.length} 笔开仓\n`)
console.log('=== 基线 ===')
printRule(base)
printRule(evalRule('仅 BUY', (t) => t.direction === 'BUY'))
printRule(evalRule('仅 SELL', (t) => t.direction === 'SELL'))
printRule(evalRule('排除 t0Must', (t) => !t.t0))
printRule(evalRule('仅 t0Must', (t) => !!t.t0))

console.log('\n=== 持仓分布（已结算）===')
const settled = trades.filter((t) => t.status === 'settled')
for (const [label, pred] of [
  ['1-4周', (t) => t.hold <= 4],
  ['5-8周', (t) => t.hold >= 5 && t.hold <= 8],
  ['≤8周成功', (t) => t.hold <= 8],
  ['9-16周', (t) => t.hold >= 9 && t.hold <= 16],
  ['17+周', (t) => t.hold >= 17],
]) {
  const n = settled.filter(pred).length
  console.log(label, n, pct(n, settled.length))
}
console.log(
  `成功(≤${N}) ${trades.filter(success).length}/${trades.length}=${pct(trades.filter(success).length, trades.length)} · 待结 ${trades.filter(pending).length}`,
)

console.log('\n=== 成功 vs 失败画像 ===')
function portrait(label, arr) {
  console.log(
    label,
    `n=${arr.length}`,
    `BUY ${arr.filter((t) => t.direction === 'BUY').length}`,
    `SELL ${arr.filter((t) => t.direction === 'SELL').length}`,
    `均|评| ${avg(arr, (t) => t.absR)?.toFixed(1)}`,
    `均FNG ${avg(arr, (t) => t.fng)?.toFixed(0)}`,
    `均Mayer ${avg(arr, (t) => t.mayer)?.toFixed(2)}`,
    `均Ahr ${avg(arr, (t) => t.ahr)?.toFixed(2)}`,
    `均Δ$${avg(arr, (t) => t.vsPrev)?.toFixed(0)}`,
    `streak1 ${arr.filter((t) => t.streak === 1).length}`,
    `t0 ${arr.filter((t) => t.t0).length}`,
  )
}
portrait('成功≤8', trades.filter(success))
portrait('慢平>8', trades.filter(failSettled))
portrait('待结', trades.filter(pending))

console.log('\n=== 规则扫描（全体）===')
const rules = [
  ['排除必', (t) => !t.t0],
  ['|评| 4-7（非极端评级）', (t) => t.absR >= 4 && t.absR <= 7],
  ['|评|≥8', (t) => t.absR >= 8],
  ['SELL', (t) => t.direction === 'SELL'],
  ['SELL 且 排除必', (t) => t.direction === 'SELL' && !t.t0],
  ['SELL 且 FNG≥55', (t) => t.direction === 'SELL' && t.fng >= 55],
  ['SELL 且 FNG≥60', (t) => t.direction === 'SELL' && t.fng >= 60],
  ['SELL 且 Mayer≥1.2', (t) => t.direction === 'SELL' && t.mayer >= 1.2],
  ['SELL 且 FNG≥55 且排除必', (t) => t.direction === 'SELL' && t.fng >= 55 && !t.t0],
  ['BUY 且排除必', (t) => t.direction === 'BUY' && !t.t0],
  ['BUY 且 |评|4-7', (t) => t.direction === 'BUY' && t.absR <= 7],
  ['BUY 且 FNG 25-50（非至暗）', (t) => t.direction === 'BUY' && t.fng >= 25 && t.fng <= 50],
  ['BUY 且 FNG>50', (t) => t.direction === 'BUY' && t.fng > 50],
  ['BUY 且 FNG≤25（至暗）', (t) => t.direction === 'BUY' && t.fng <= 25],
  ['BUY 且 Mayer≥0.9', (t) => t.direction === 'BUY' && t.mayer >= 0.9],
  ['BUY 且 Mayer<0.85', (t) => t.direction === 'BUY' && t.mayer < 0.85],
  ['BUY 且 Ahr>0.55', (t) => t.direction === 'BUY' && t.ahr > 0.55],
  ['BUY 且 Ahr≤0.45', (t) => t.direction === 'BUY' && t.ahr <= 0.45],
  ['同向第1周信号', (t) => t.streak === 1],
  ['同向第2周+', (t) => t.streak >= 2],
  ['逆势Δ', (t) => (t.direction === 'BUY' ? t.vsPrev > 0 : t.vsPrev < 0)],
  ['顺势Δ', (t) => (t.direction === 'BUY' ? t.vsPrev < 0 : t.vsPrev > 0)],
  // 组合候选
  ['荐候选1: SELL+FNG≥55+非必', (t) => t.direction === 'SELL' && t.fng >= 55 && !t.t0],
  [
    '荐候选2: BUY+非必+FNG∈[25,55]+Mayer≥0.88',
    (t) =>
      t.direction === 'BUY' &&
      !t.t0 &&
      t.fng >= 25 &&
      t.fng <= 55 &&
      t.mayer >= 0.88,
  ],
  [
    '荐候选3: (|评|4-7)+非必+(SELL且FNG≥55 或 BUY且FNG∈[25,55])',
    (t) =>
      t.absR <= 7 &&
      !t.t0 &&
      ((t.direction === 'SELL' && t.fng >= 55) ||
        (t.direction === 'BUY' && t.fng >= 25 && t.fng <= 55)),
  ],
  [
    '荐候选4: 非必+第1周+(SELL FNG≥55 | BUY FNG25-55 Mayer≥0.88)',
    (t) =>
      !t.t0 &&
      t.streak === 1 &&
      ((t.direction === 'SELL' && t.fng >= 55) ||
        (t.direction === 'BUY' && t.fng >= 25 && t.fng <= 55 && t.mayer >= 0.88)),
  ],
  [
    '荐候选5: 非必+(SELL | BUY非至暗FNG>25)',
    (t) => !t.t0 && (t.direction === 'SELL' || (t.direction === 'BUY' && t.fng > 25)),
  ],
]

for (const [name, pred] of rules) printRule(evalRule(name, pred))

// 样本外：2025 定规则直觉，看 2026；再反过来
console.log('\n=== 分年（基线与候选）===')
for (const year of [2025, 2026]) {
  const sub = trades.filter((t) => t.year === year)
  console.log(`\n-- ${year} n=${sub.length} --`)
  for (const key of [
    '对照·全部信号',
    '仅 SELL',
    '仅 BUY',
    '荐候选1: SELL+FNG≥55+非必',
    '荐候选2: BUY+非必+FNG∈[25,55]+Mayer≥0.88',
    '荐候选3: (|评|4-7)+非必+(SELL且FNG≥55 或 BUY且FNG∈[25,55])',
    '荐候选4: 非必+第1周+(SELL FNG≥55 | BUY FNG25-55 Mayer≥0.88)',
  ]) {
    const pred = rules.find((r) => r[0] === key)?.[1] || (key === '对照·全部信号' ? () => true : key === '仅 SELL' ? (t) => t.direction === 'SELL' : key === '仅 BUY' ? (t) => t.direction === 'BUY' : null)
    if (!pred && key.startsWith('对照')) {
      printRule(evalRule(key, () => true, sub))
      continue
    }
    if (key === '对照·全部信号') {
      printRule(evalRule(key, () => true, sub))
      continue
    }
    if (key === '仅 SELL') {
      printRule(evalRule(key, (t) => t.direction === 'SELL', sub))
      continue
    }
    if (key === '仅 BUY') {
      printRule(evalRule(key, (t) => t.direction === 'BUY', sub))
      continue
    }
    const rule = rules.find((r) => r[0] === key)
    if (rule) printRule(evalRule(key, rule[1], sub))
  }
}

console.log('\n=== 成功明细（≤8周）===')
for (const t of trades.filter(success).sort((a, b) => a.hold - b.hold)) {
  console.log(
    t.week,
    t.direction,
    `评${t.rating}`,
    `持${t.hold}`,
    `→${t.exitWeek}`,
    `FNG${Math.round(t.fng)}`,
    `Mayer${t.mayer?.toFixed(2)}`,
    `Ahr${t.ahr?.toFixed(2)}`,
    `streak${t.streak}`,
    t.t0 ? '必' : '',
  )
}
