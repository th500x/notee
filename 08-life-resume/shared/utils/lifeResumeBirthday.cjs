/**
 * 人生片段生日：年 / 月 / 日校验与展示
 * 须与 lifeResumeBirthday.js 同步
 */

const BIRTH_YEAR_MIN = 1900;

function toIntOrNull(value) {
  if (value === '' || value == null) return null;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isInteger(n) ? n : null;
}

function todayYmd(now = new Date()) {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function getBirthYearMax(now = new Date()) {
  return now.getFullYear();
}

/** 今年起倒序到 1900，供下拉 */
function getBirthYearOptions(now = new Date()) {
  const max = getBirthYearMax(now);
  const years = [];
  for (let y = max; y >= BIRTH_YEAR_MIN; y -= 1) {
    years.push(y);
  }
  return years;
}

function daysInMonth(year, month) {
  const y = toIntOrNull(year);
  const m = toIntOrNull(month);
  if (y == null || m == null || m < 1 || m > 12) return 0;
  return new Date(y, m, 0).getDate();
}

function isFutureYmd(year, month, day, now = new Date()) {
  const today = todayYmd(now);
  if (year > today.year) return true;
  if (year === today.year && month > today.month) return true;
  if (year === today.year && month === today.month && day > today.day) return true;
  return false;
}

/**
 * @param {{ birthYear?: unknown, birthMonth?: unknown, birthDay?: unknown }} input
 * @param {Date} [now]
 * @returns {{ ok: true, birthYear: number, birthMonth: number, birthDay: number } | { ok: false, error: string }}
 */
function validateBirthDate(input, now = new Date()) {
  const year = toIntOrNull(input?.birthYear);
  const month = toIntOrNull(input?.birthMonth);
  const day = toIntOrNull(input?.birthDay);
  const yearMax = getBirthYearMax(now);

  if (year == null) {
    return { ok: false, error: '请选择出生年' };
  }
  if (year < BIRTH_YEAR_MIN || year > yearMax) {
    return { ok: false, error: '请选择有效的出生年' };
  }
  if (month == null) {
    return { ok: false, error: '请选择生日月份' };
  }
  if (month < 1 || month > 12) {
    return { ok: false, error: '请选择有效的生日月份' };
  }
  if (day == null) {
    return { ok: false, error: '请选择出生日' };
  }
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) {
    return { ok: false, error: '该月没有这一天' };
  }
  if (isFutureYmd(year, month, day, now)) {
    return { ok: false, error: '生日不能是未来日期' };
  }
  return { ok: true, birthYear: year, birthMonth: month, birthDay: day };
}

function formatBirthDateLabel({ birthYear, birthMonth, birthDay } = {}) {
  const y = toIntOrNull(birthYear);
  const m = toIntOrNull(birthMonth);
  const d = toIntOrNull(birthDay);
  if (y && m && d) {
    return `${y}年${m}月${d}日`;
  }
  const parts = [];
  if (y) parts.push(`${y}年`);
  if (m) parts.push(`${m}月`);
  if (d) parts.push(`${d}日`);
  if (parts.length === 0) return '未填写';
  return `${parts.join('')}（未填完整）`;
}

function toPublicBirthday(row = {}) {
  const birthYear = toIntOrNull(row.birthYear);
  const birthMonth = toIntOrNull(row.birthMonth);
  const birthDay = toIntOrNull(row.birthDay);
  let birthdayChangedAt = row.birthdayChangedAt || null;
  if (birthdayChangedAt instanceof Date) {
    birthdayChangedAt = birthdayChangedAt.toISOString();
  } else if (birthdayChangedAt) {
    birthdayChangedAt = String(birthdayChangedAt);
  }
  return {
    birthYear,
    birthMonth,
    birthDay,
    birthdayChangedAt,
    canChangeBirthday: !row.birthdayChangedAt,
  };
}

module.exports = {
  BIRTH_YEAR_MIN,
  getBirthYearMax,
  getBirthYearOptions,
  daysInMonth,
  validateBirthDate,
  formatBirthDateLabel,
  toPublicBirthday,
};
