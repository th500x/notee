const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calendarDay, nextRunAt, firstOfNextMonth, summarizeDailyRows } = require('./walletAssetCalendar');

describe('calendarDay', () => {
  it('uses the UTC calendar date', () => {
    assert.equal(calendarDay(new Date('2026-09-29T17:30:00.000Z')), '2026-09-29');
    assert.equal(calendarDay(new Date('2026-09-29T23:59:00.000Z')), '2026-09-29');
    assert.equal(calendarDay(new Date('2026-09-30T00:01:00.000Z')), '2026-09-30');
  });
});

describe('nextRunAt', () => {
  it('lands on the next even UTC hour at minute 5', () => {
    assert.equal(nextRunAt(new Date('2026-10-02T10:17:00.000Z')).toISOString(), '2026-10-02T12:05:00.000Z');
    assert.equal(nextRunAt(new Date('2026-10-02T11:59:00.000Z')).toISOString(), '2026-10-02T12:05:00.000Z');
    assert.equal(nextRunAt(new Date('2026-10-02T12:04:59.000Z')).toISOString(), '2026-10-02T12:05:00.000Z');
  });

  it('skips the current slot once it has started', () => {
    assert.equal(nextRunAt(new Date('2026-10-02T12:05:00.000Z')).toISOString(), '2026-10-02T14:05:00.000Z');
  });

  it('rolls over to 00:05 of the next UTC day', () => {
    assert.equal(nextRunAt(new Date('2026-12-31T22:30:00.000Z')).toISOString(), '2027-01-01T00:05:00.000Z');
  });
});

describe('firstOfNextMonth', () => {
  it('moves a late-September save to October 1 and wraps December', () => {
    assert.equal(firstOfNextMonth('2026-09-29'), '2026-10-01');
    assert.equal(firstOfNextMonth('2026-12-31'), '2027-01-01');
  });
});

describe('summarizeDailyRows', () => {
  it('averages only the days that were recorded', () => {
    const months = summarizeDailyRows([
      { snapshotDate: '2026-10-01', totalUsd: 100 },
      { snapshotDate: '2026-10-03', totalUsd: 300 },
      { snapshotDate: '2026-11-01', totalUsd: 50 },
    ]);
    assert.deepEqual(months, [
      { month: '2026-10', averageUsd: 200, days: 2 },
      { month: '2026-11', averageUsd: 50, days: 1 },
    ]);
  });
});
