import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isIsoInCurrentOrPreviousCalendarMonth } from './accountingDates.js'

describe('isIsoInCurrentOrPreviousCalendarMonth', () => {
  const sept = new Date(2026, 8, 7)

  it('marks current and previous month numbers in any year', () => {
    assert.equal(isIsoInCurrentOrPreviousCalendarMonth('2026-09-05', sept), true)
    assert.equal(isIsoInCurrentOrPreviousCalendarMonth('2026-08-30', sept), true)
    assert.equal(isIsoInCurrentOrPreviousCalendarMonth('2025-09-21', sept), true)
    assert.equal(isIsoInCurrentOrPreviousCalendarMonth('2025-08-12', sept), true)
  })

  it('does not mark other months', () => {
    assert.equal(isIsoInCurrentOrPreviousCalendarMonth('2026-07-31', sept), false)
    assert.equal(isIsoInCurrentOrPreviousCalendarMonth('2026-04-17', sept), false)
    assert.equal(isIsoInCurrentOrPreviousCalendarMonth('2025-10-05', sept), false)
    assert.equal(isIsoInCurrentOrPreviousCalendarMonth('2026-10-01', sept), false)
  })

  it('wraps previous month from January to December', () => {
    const jan = new Date(2026, 0, 3)
    assert.equal(isIsoInCurrentOrPreviousCalendarMonth('2026-01-01', jan), true)
    assert.equal(isIsoInCurrentOrPreviousCalendarMonth('2025-12-20', jan), true)
    assert.equal(isIsoInCurrentOrPreviousCalendarMonth('2026-11-01', jan), false)
  })

  it('rejects invalid iso', () => {
    assert.equal(isIsoInCurrentOrPreviousCalendarMonth('', sept), false)
    assert.equal(isIsoInCurrentOrPreviousCalendarMonth('2026-13-01', sept), false)
  })
})
