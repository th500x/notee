/**
 * 钱包月均用的日历：UTC。日记录的日期、起算日、定时轮次都按 UTC 算。
 */

const TIME_ZONE = 'UTC';
const RUN_EVERY_HOURS = 2;
const RUN_AT_MINUTE = 5;

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

/** 下一轮：UTC 偶数整点过 5 分（00:05、02:05 … 22:05），严格晚于 now */
function nextRunAt(now = new Date()) {
  const ms = now.getTime();
  const hour = now.getUTCHours();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour - (hour % RUN_EVERY_HOURS),
    RUN_AT_MINUTE,
    0,
    0
  ));
  while (next.getTime() <= ms) {
    next.setUTCHours(next.getUTCHours() + RUN_EVERY_HOURS);
  }
  return next;
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
  nextRunAt,
  firstOfNextMonth,
  summarizeDailyRows,
};
