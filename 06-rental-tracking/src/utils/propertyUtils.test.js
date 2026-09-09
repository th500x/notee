import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCommissionAmountFromNote,
  sumCommissionFromProjects,
  isYearMonthInView,
} from './propertyUtils.js'

describe('parseCommissionAmountFromNote', () => {
  it('returns null when note has no commission keyword', () => {
    assert.equal(parseCommissionAmountFromNote('物业费 2000', 8000), null)
    assert.equal(parseCommissionAmountFromNote('', 8000), null)
  })

  it('uses monthly rent when 佣金 or 半佣 has no trailing number', () => {
    assert.equal(parseCommissionAmountFromNote('佣金', 8000), 8000)
    assert.equal(parseCommissionAmountFromNote('半佣已付', 6500), 6500)
  })

  it('uses the number immediately after the keyword', () => {
    assert.equal(parseCommissionAmountFromNote('佣金5000', 8000), 5000)
    assert.equal(parseCommissionAmountFromNote('半佣 2,500', 8000), 2500)
    assert.equal(parseCommissionAmountFromNote('佣金：4500.5', 8000), 4500.5)
  })
})

describe('isYearMonthInView', () => {
  it('filters month and year views', () => {
    assert.equal(isYearMonthInView('2026-08', 2026, 8, 'month'), true)
    assert.equal(isYearMonthInView('2026-07', 2026, 8, 'month'), false)
    assert.equal(isYearMonthInView('2026-07', 2026, 8, 'year'), true)
    assert.equal(isYearMonthInView('2025-08', 2026, 8, 'year'), false)
  })
})

describe('sumCommissionFromProjects', () => {
  const projects = [
    {
      properties: [
        {
          monthlyRent: 10000,
          records: [
            { date: '2026-08', note: '佣金', expenses: 10000 },
            { date: '2026-08', note: '维修', expenses: 3000 },
            { date: '2026-07', note: '半佣 4000', expenses: 4000 },
          ],
        },
      ],
    },
  ]

  it('sums only in-view property notes with commission keywords', () => {
    assert.equal(sumCommissionFromProjects(projects, 2026, 8, 'month'), 10000)
    assert.equal(sumCommissionFromProjects(projects, 2026, 8, 'year'), 14000)
  })
})
