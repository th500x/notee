/**
 * 账目单日期列：存 ISO `YYYY-MM-DD`，展示为 2026/3/1 或 3/1。
 */

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {string} s
 * @returns {boolean}
 */
export function isIsoDateString(s) {
  if (typeof s !== 'string' || !ISO_RE.test(s)) return false;
  const [y, mo, d] = s.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/**
 * @param {string} iso
 * @returns {string} `YYYY-MM` 或 `''`
 */
export function isoToMonthKey(iso) {
  const s = sanitizeIsoDateField(iso);
  return s ? s.slice(0, 7) : '';
}

/**
 * 列月是否早于「实际入住日」所在月（该月视为空置，交租空位不标红）。
 * @param {string} monthKey `YYYY-MM`
 * @param {string} actualRentIso
 */
export function isMonthBeforeActualRent(monthKey, actualRentIso) {
  const actualMk = isoToMonthKey(actualRentIso);
  if (!actualMk || !/^\d{4}-\d{2}$/.test(String(monthKey || '').trim())) return false;
  return monthKey.trim() < actualMk;
}

/**
 * 用于申报/实际列：当月相关的日期一律红色提示。
 */
export function isIsoInCurrentCalendarMonth(iso, refDate = new Date()) {
  if (!isIsoDateString(iso)) return false;
  const mo = Number(iso.slice(5, 7));
  if (!Number.isInteger(mo) || mo < 1 || mo > 12) return false;
  return mo === refDate.getMonth() + 1;
}

/**
 * @param {unknown} s
 * @returns {string} ISO 或 ''
 */
export function sanitizeIsoDateField(s) {
  if (typeof s !== 'string') return '';
  const t = s.trim().slice(0, 10);
  return isIsoDateString(t) ? t : '';
}

/** 如 2026/3/1 */
export function formatYmdSlash(iso) {
  if (!isIsoDateString(iso)) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}/${m}/${d}`;
}

/** 如 3/1 */
export function formatMdSlash(iso) {
  if (!isIsoDateString(iso)) return '—';
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
}

/** 本机当天的「月/日」，如 9/2（不用 UTC，避免跨日错位） */
export function formatTodayMdSlash(refDate = new Date()) {
  return `${refDate.getMonth() + 1}/${refDate.getDate()}`;
}

/**
 * 交租空格点按：用当天月/日 + 列锚年份拼 ISO。
 * @returns {string} ISO 或 `''`
 */
export function defaultPayRentIsoFromToday(anchorMonthKey, refDate = new Date()) {
  return parseMdTextToIso(anchorMonthKey, formatTodayMdSlash(refDate));
}

/**
 * 交租列：列锚 `YYYY-MM` + 用户输入「月/日」→ 用锚点年份拼完整 ISO（不弹出「年」级 date 控件）。
 * @param {string} anchorMonthKey `YYYY-MM`
 * @param {string} text 如 `3/1`、`03-01`
 * @returns {string} ISO 或 `''`
 */
export function parseMdTextToIso(anchorMonthKey, text) {
  const am = /^(\d{4})-(\d{2})$/.exec(String(anchorMonthKey || '').trim());
  if (!am) return '';
  const year = Number(am[1]);
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  const parts = raw.split(/[/\-.年月日\s]+/).filter((p) => p.length > 0);
  if (parts.length !== 2) return '';
  const mo = Number(parts[0]);
  const day = Number(parts[1]);
  if (!Number.isInteger(mo) || !Number.isInteger(day) || mo < 1 || mo > 12 || day < 1 || day > 31) {
    return '';
  }
  const iso = `${year}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isIsoDateString(iso) ? iso : '';
}
