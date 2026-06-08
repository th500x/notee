/**
 * 历史上的今天 · 从共享 JSON 取当日条目（32-6 §6）
 */

const REGION_ORDER = { east_asia: 0, asia: 1, europe: 2, other: 3 };

function dayKey(month, day) {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** @param {Date} [date] 墙钟自然日，与 pickHistoryEntriesForToday 一致 */
export function formatHistoryMonthDayLabel(date = new Date()) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/** * @param {object|null|undefined} data historyOnThisDay.json
 * @param {Date} [date]
 * @returns {Array<{ region: string, yearLabel: string, text: string }>}
 */
export function pickHistoryEntriesForToday(data, date = new Date()) {
  if (!data) return [];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const key = dayKey(month, day);

  /** @type {Array<{ region?: string, yearLabel?: string, text?: string }>} */
  let entries = [];

  if (data.days && typeof data.days === 'object' && !Array.isArray(data.days)) {
    entries = data.days[key] || [];
  } else if (Array.isArray(data)) {
    entries = data
      .filter((d) => Number(d.month) === month && Number(d.day) === day)
      .flatMap((d) => d.entries || []);
  } else if (Number(data.month) === month && Number(data.day) === day) {
    entries = data.entries || [];
  }

  return (entries || [])
    .filter((e) => e && String(e.text || '').trim())
    .sort((a, b) => {
      const ra = REGION_ORDER[a.region] ?? 99;
      const rb = REGION_ORDER[b.region] ?? 99;
      if (ra !== rb) return ra - rb;
      return String(a.yearLabel || '').localeCompare(String(b.yearLabel || ''));
    })
    .slice(0, 5)
    .map((e) => ({
      region: e.region || 'other',
      yearLabel: String(e.yearLabel || '').trim(),
      text: String(e.text || '').trim(),
    }));
}
