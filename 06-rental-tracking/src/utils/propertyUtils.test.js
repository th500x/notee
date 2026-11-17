import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCommissionAmountFromNote,
  sumCommissionFromProjects,
  isYearMonthInView,
  getMonthlyExpenseTipLabels,
} from './propertyUtils.js'

describe('parseCommissionAmountFromNote', () => {
  it('returns null when note has no commission keyword', () => {
    assert.equal(parseCommissionAmountFromNote('物业费 2000', 8000), null)
    assert.equal(parseCommissionAmountFromNote('', 8000), null)
  })

  it('uses monthly rent when 佣金 has no trailing number', () => {
    assert.equal(parseCommissionAmountFromNote('佣金', 8000), 8000)
    assert.equal(parseCommissionAmountFromNote('半佣已付', 6500), null)
  })

  it('uses the number immediately after the keyword', () => {
    assert.equal(parseCommissionAmountFromNote('佣金5000', 8000), 5000)
    assert.equal(parseCommissionAmountFromNote('半佣 2,500', 8000), null)
    assert.equal(parseCommissionAmountFromNote('佣金：4500.5', 8000), 4500.5)
  })
})

describe('getMonthlyExpenseTipLabels', () => {
  it('uses rent when 佣金 has no number, and only marks 其他支出 from 3000', () => {
    const shown = {
      monthlyRent: 6000,
      records: [
        { date: '2026-10', note: '佣金', expenses: 6000 },
        { date: '2026-10', note: '更换水龙头', expenses: 3000 },
      ],
    }
    const hidden = {
      monthlyRent: 6000,
      records: [
        { date: '2026-10', note: '佣金', expenses: 6000 },
        { date: '2026-10', note: '更换水龙头', expenses: 1740 },
      ],
    }
    assert.deepEqual(getMonthlyExpenseTipLabels(shown, '2026-10'), ['佣金支出', '其他支出'])
    assert.deepEqual(getMonthlyExpenseTipLabels(hidden, '2026-10'), ['佣金支出'])
  })

  it('prefers the number after 佣金 over the rent', () => {
    const property = {
      monthlyRent: 6000,
      records: [
        { date: '2026-10', note: '佣金8000', expenses: 8000 },
        { date: '2026-10', note: '维修', expenses: 2000 },
      ],
    }
    assert.deepEqual(getMonthlyExpenseTipLabels(property, '2026-10'), ['佣金支出'])
  })

  it('shows only 其他支出 when the month is not commission', () => {
    const property = {
      monthlyRent: 6000,
      records: [
        { date: '2026-10', note: '物业费', expenses: 1740 },
        { date: '2026-10', note: '更换水槽', expenses: 890 },
      ],
    }
    assert.deepEqual(getMonthlyExpenseTipLabels(property, '2026-10'), ['其他支出'])
  })

  it('marks 佣金支出 without an amount floor', () => {
    const property = {
      monthlyRent: 6000,
      records: [{ date: '2026-10', note: '佣金', expenses: 100 }],
    }
    assert.deepEqual(getMonthlyExpenseTipLabels(property, '2026-10'), ['佣金支出'])
  })

  it('shows 其他支出 from 500 and hides anything smaller', () => {
    const atFloor = {
      monthlyRent: 6000,
      records: [{ date: '2026-10', note: '维修', expenses: 500 }],
    }
    const belowFloor = {
      monthlyRent: 6000,
      records: [{ date: '2026-10', note: '维修', expenses: 499 }],
    }
    assert.deepEqual(getMonthlyExpenseTipLabels(atFloor, '2026-10'), ['其他支出'])
    assert.deepEqual(getMonthlyExpenseTipLabels(belowFloor, '2026-10'), [])
  })

  it('does not mark 半佣 as commission', () => {
    const property = {
      monthlyRent: 6000,
      records: [{ date: '2026-10', note: '半佣已付', expenses: 3000 }],
    }
    assert.deepEqual(getMonthlyExpenseTipLabels(property, '2026-10'), ['其他支出'])
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
            { date: '2026-07', note: '佣金 4000', expenses: 4000 },
          ],
        },
      ],
    },
  ]

  it('sums only in-view property notes with 佣金 keyword', () => {
    assert.equal(sumCommissionFromProjects(projects, 2026, 8, 'month'), 10000)
    assert.equal(sumCommissionFromProjects(projects, 2026, 8, 'year'), 14000)
  })
})
