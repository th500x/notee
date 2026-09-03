import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { groupTradesByYearMonth } from './ethMaTradeGroups.js'

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

  it('skips empty months and invalid dates', () => {
    const grouped = groupTradesByYearMonth([{ signalOpenTime: 'nope' }])
    assert.deepEqual(grouped, [])
  })
})
