/**
 * 与前端 accountingDates 一致：ISO YYYY-MM-DD 校验与清洗。
 */

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDateString(s) {
  if (typeof s !== 'string' || !ISO_RE.test(s)) return false;
  const [y, mo, d] = s.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

function sanitizeIsoDateField(s) {
  if (typeof s !== 'string') return '';
  const t = s.trim().slice(0, 10);
  return isIsoDateString(t) ? t : '';
}

module.exports = { sanitizeIsoDateField };
