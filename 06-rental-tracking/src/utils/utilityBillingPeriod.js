const ISO_YMD = /^\d{4}-\d{2}-\d{2}$/

/**
 * @param {unknown} raw
 * @returns {string} '' or 'YYYY-MM-DD'
 */
export function sanitizeOptionalIsoYmd(raw) {
  if (typeof raw !== 'string') return ''
  const t = raw.trim()
  return ISO_YMD.test(t) ? t : ''
}

/**
 * Calendar day arithmetic in UTC (no local DST surprises for date-only values).
 * @param {string} isoYmd
 * @param {number} deltaDays
 * @returns {string} '' if input invalid
 */
export function addCalendarDaysIsoYmd(isoYmd, deltaDays) {
  if (!ISO_YMD.test(isoYmd)) return ''
  const [y, m, d] = isoYmd.split('-').map((x) => parseInt(x, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

/**
 * Valid when: not both set, or end is strictly after start.
 * @param {unknown} startIso
 * @param {unknown} endIso
 */
export function isUtilityReadingPeriodOrderValid(startIso, endIso) {
  const a = sanitizeOptionalIsoYmd(startIso)
  const b = sanitizeOptionalIsoYmd(endIso)
  if (!a || !b) return true
  return b > a
}

/**
 * Subtitle line for utility PNG (English). Falls back to legacy free-text month/date if no ISO period.
 * @param {object} sheet
 */
export function formatUtilityBillingPeriodSubtitle(sheet) {
  if (!sheet || typeof sheet !== 'object') return 'Billing period: —'
  const start = sanitizeOptionalIsoYmd(sheet.readingPeriodStartIso)
  const end = sanitizeOptionalIsoYmd(sheet.readingPeriodEndIso)
  if (start || end) {
    return `Billing period: ${start || '—'}  →  ${end || '—'}`
  }
  const m = typeof sheet.readingMonthText === 'string' ? sheet.readingMonthText.trim() : ''
  const d = typeof sheet.readingDateText === 'string' ? sheet.readingDateText.trim() : ''
  if (m || d) {
    return `Billing month: ${m || '—'}     Reading date: ${d || '—'}`
  }
  return 'Billing period: —'
}
