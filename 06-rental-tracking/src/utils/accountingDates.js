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
 * ISO 日期的公历「月份」与 refDate 所在月份相同则为 true（忽略年份）。
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
