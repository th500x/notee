/**
 * Natural day / month keys in UTC+7 (Asia/Bangkok).
 * Matches product rule in 02-One-Line.md §2.1 / §2.4.
 */

const { httpError } = require('./httpError');

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function shiftedUtcParts(date = new Date()) {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
  };
}

function dayKeyFromDate(date = new Date()) {
  const { y, m, d } = shiftedUtcParts(date);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Natural month in UTC+7, format YYYY-MM. */
function monthKeyFromDate(date = new Date()) {
  const { y, m } = shiftedUtcParts(date);
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Previous calendar month in UTC+7. */
function previousMonthKey(date = new Date()) {
  const { y, m } = shiftedUtcParts(date);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
}

function assertMonthKey(raw) {
  if (typeof raw !== 'string' || !MONTH_KEY_RE.test(raw)) {
    throw httpError(400, 'month 须为 YYYY-MM', 'BAD_MONTH');
  }
  return raw;
}

/** Post lifetime: 30 calendar days from create (wall clock). */
function expiresAtFrom(created = new Date()) {
  return new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
}

/** Store DATETIME as UTC wall time (no TZ suffix). */
function toMysqlDateTimeUtc(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = {
  TZ_OFFSET_MS,
  MONTH_KEY_RE,
  dayKeyFromDate,
  monthKeyFromDate,
  previousMonthKey,
  assertMonthKey,
  expiresAtFrom,
  toMysqlDateTimeUtc,
};
