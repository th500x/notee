/**
 * 钱包月均用的日历。与用户所在日期一致：Asia/Bangkok（UTC+7）。
 */

const TIME_ZONE = 'Asia/Bangkok';

function calendarDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type).value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function firstOfNextMonth(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
  if (!match) {
    throw new Error('无效日期');
  }
  let year = Number(match[1]);
  let month = Number(match[2]) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function summarizeDailyRows(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    const day = String(row.snapshotDate || '').slice(0, 10);
    const total = Number(row.totalUsd);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(total)) continue;
    const month = day.slice(0, 7);
    const group = groups.get(month) || { month, sum: 0, days: 0 };
    group.sum += total;
    group.days += 1;
    groups.set(month, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((group) => ({
      month: group.month,
      averageUsd: Math.round((group.sum / group.days) * 100) / 100,
      days: group.days,
    }));
}

module.exports = {
  TIME_ZONE,
  calendarDay,
  firstOfNextMonth,
  summarizeDailyRows,
};
