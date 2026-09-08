import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { averageHoldDays, groupTradesByYearMonth, sumTradePnl, tradeHoldDays } from './ethMaTradeGroups.js'

describe('sumTradePnl', () => {
  it('adds filled pnl and treats missing as 0', () => {
    assert.equal(sumTradePnl([{ pnl: 10.1 }, { pnl: -3 }, { pnl: null }, {}]), 7.1)
    assert.equal(sumTradePnl([]), 0)
  })
})

describe('tradeHoldDays / averageHoldDays', () => {
  it('counts calendar days from signal date to closedOn', () => {
    assert.equal(
      tradeHoldDays({
        signalOpenTime: new Date(2026, 8, 6, 16, 59, 59).getTime(),
        closedOn: '2026-09-07',
      }),
      1
    )
    assert.equal(
      tradeHoldDays({
        signalOpenTime: new Date(2026, 8, 7, 5, 59, 59).getTime(),
        closedOn: '2026-09-07',
      }),
      0
    )
  })

  it('skips open trades and averages the rest', () => {
    assert.equal(
      averageHoldDays([
        { signalOpenTime: new Date(2026, 8, 5, 12).getTime(), closedOn: '2026-09-07' },
        { signalOpenTime: new Date(2026, 8, 6, 12).getTime(), closedOn: '' },
        { signalOpenTime: new Date(2026, 8, 6, 12).getTime(), closedOn: '2026-09-07' },
      ]),
      1.5
    )
    assert.equal(averageHoldDays([{ signalOpenTime: Date.now(), closedOn: '' }]), null)
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

  it('attaches average hold days from closedOn only', () => {
    const grouped = groupTradesByYearMonth([
      {
        signalOpenTime: new Date(2026, 8, 5, 12).getTime(),
        closedOn: '2026-09-07',
        pnl: 1,
      },
      {
        signalOpenTime: new Date(2026, 8, 6, 12).getTime(),
        closedOn: '',
        pnl: 2,
      },
    ])
    const year2026 = grouped.find((item) => item.year === 2026)
    const september = year2026.months.find((item) => item.month === 9)
    assert.equal(year2026.avgHoldDays, 2)
    assert.equal(september.avgHoldDays, 2)
  })

  it('skips empty months and invalid dates', () => {
    const grouped = groupTradesByYearMonth([{ signalOpenTime: 'nope' }])
    assert.deepEqual(grouped, [])
  })
})
