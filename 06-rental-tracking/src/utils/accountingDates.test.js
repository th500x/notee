import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isIsoOnOrBeforeCurrentCalendarMonth } from './accountingDates.js'

describe('isIsoOnOrBeforeCurrentCalendarMonth', () => {
  const ref = new Date(2026, 8, 7)

  it('marks current month and earlier months red', () => {
    assert.equal(isIsoOnOrBeforeCurrentCalendarMonth('2026-09-05', ref), true)
    assert.equal(isIsoOnOrBeforeCurrentCalendarMonth('2026-09-20', ref), true)
    assert.equal(isIsoOnOrBeforeCurrentCalendarMonth('2026-08-30', ref), true)
    assert.equal(isIsoOnOrBeforeCurrentCalendarMonth('2025-10-05', ref), true)
    assert.equal(isIsoOnOrBeforeCurrentCalendarMonth('2025-09-21', ref), true)
  })

  it('does not mark later months', () => {
    assert.equal(isIsoOnOrBeforeCurrentCalendarMonth('2026-10-01', ref), false)
    assert.equal(isIsoOnOrBeforeCurrentCalendarMonth('2027-01-01', ref), false)
  })

  it('rejects invalid iso', () => {
    assert.equal(isIsoOnOrBeforeCurrentCalendarMonth('', ref), false)
    assert.equal(isIsoOnOrBeforeCurrentCalendarMonth('2026-13-01', ref), false)
  })
})
