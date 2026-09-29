const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calendarDay, firstOfNextMonth, summarizeDailyRows } = require('./walletAssetCalendar');

describe('calendarDay', () => {
  it('uses the Bangkok calendar date', () => {
    assert.equal(calendarDay(new Date('2026-09-29T16:30:00.000Z')), '2026-09-29');
    assert.equal(calendarDay(new Date('2026-09-29T17:30:00.000Z')), '2026-09-30');
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
