import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { groupTradesByYearMonth, sumTradePnl } from './ethMaTradeGroups.js'

describe('sumTradePnl', () => {
  it('adds filled pnl and treats missing as 0', () => {
    assert.equal(sumTradePnl([{ pnl: 10.1 }, { pnl: -3 }, { pnl: null }, {}]), 7.1)
    assert.equal(sumTradePnl([]), 0)
  })
})

describe('groupTradesByYearMonth', () => {
  it('groups by local year then month, newest first', () => {
    const grouped = groupTradesByYearMonth([
      { signalOpenTime: Date.UTC(2026, 8, 3, 5) },
      { signalOpenTime: Date.UTC(2025, 0, 2, 5) },
      { signalOpenTime: Date.UTC(2026, 7, 1, 5) },
    ])
    assert.equal(grouped[0].year, 2026)
    assert.equal(grouped[1].year, 2025)
    assert.ok(grouped[0].months.length >= 1)
  })

  it('attaches year and month pnl totals', () => {
    const grouped = groupTradesByYearMonth([
      { signalOpenTime: new Date(2026, 8, 3, 12).getTime(), pnl: 12.5 },
      { signalOpenTime: new Date(2026, 8, 4, 12).getTime(), pnl: null },
      { signalOpenTime: new Date(2026, 7, 1, 12).getTime(), pnl: -2 },
    ])
    const year2026 = grouped.find((item) => item.year === 2026)
    assert.equal(year2026.pnlTotal, 10.5)
    const september = year2026.months.find((item) => item.month === 9)
    const august = year2026.months.find((item) => item.month === 8)
    assert.equal(september.pnlTotal, 12.5)
    assert.equal(august.pnlTotal, -2)
  })

  it('skips empty months and invalid dates', () => {
    const grouped = groupTradesByYearMonth([{ signalOpenTime: 'nope' }])
    assert.deepEqual(grouped, [])
  })
})
