/**
 * 周历定义 — 与 src/utils/weekCalculator.js 对齐（脚本侧副本）
 * 2025 为锚点；2026 起由上一年最后一周结束日的次日连推周一～周日。
 */
const WEEK_LIMITS = { STANDARD_WEEKS: 52, MAX_WEEKS: 53 }
const YEAR_MIN = 2025

const SPECIAL_WEEKS = {
  '2025-W53': { start: new Date(2025, 11, 29), end: new Date(2026, 0, 4) },
}

const formatWeekId = (year, weekNum) =>
  `${year}-W${weekNum.toString().padStart(2, '0')}`

const atNoon = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)

const addDays = (date, days) => {
  const next = atNoon(date)
  next.setDate(next.getDate() + days)
  return next
}

function getWeeksInYear2025() {
  const year = 2025
  const weeks = []
  let currentDate = new Date(year, 0, 1)
  const dayOfWeek = currentDate.getDay()
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  currentDate.setDate(currentDate.getDate() + daysToMonday)

  for (let weekNum = 1; weekNum <= WEEK_LIMITS.STANDARD_WEEKS; weekNum++) {
    const weekEnd = new Date(currentDate)
    weekEnd.setDate(currentDate.getDate() + 6)
    weeks.push({
      id: formatWeekId(year, weekNum),
      weekNumber: weekNum,
      startDate: atNoon(currentDate),
      endDate: atNoon(weekEnd),
      year,
    })
    currentDate.setDate(currentDate.getDate() + 7)
  }

  const w53 = SPECIAL_WEEKS['2025-W53']
  weeks.push({
    id: '2025-W53',
    weekNumber: 53,
    startDate: atNoon(w53.start),
    endDate: atNoon(w53.end),
    year: 2025,
  })
  return weeks
}

function deriveWeeksFromPreviousYear(year) {
  const prev = getWeeksInYear(year - 1)
  if (!prev.length) return []
  let current = addDays(prev[prev.length - 1].endDate, 1)
  const weeks = []
  for (let weekNum = 1; weekNum <= WEEK_LIMITS.MAX_WEEKS; weekNum++) {
    if (current.getFullYear() > year) break
    const weekEnd = addDays(current, 6)
    weeks.push({
      id: formatWeekId(year, weekNum),
      weekNumber: weekNum,
      startDate: new Date(current),
      endDate: weekEnd,
      year,
    })
    current = addDays(current, 7)
  }
  return weeks
}

export function getWeeksInYear(year) {
  const y = Number(year)
  if (!Number.isInteger(y) || y < YEAR_MIN) return []
  if (y === 2025) return getWeeksInYear2025()
  return deriveWeeksFromPreviousYear(y)
}

function toCalendarDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isDateInWeek(date, week) {
  const day = toCalendarDay(date)
  const start = toCalendarDay(week.startDate)
  const end = toCalendarDay(week.endDate)
  return day >= start && day <= end
}

export function findWeekIdForDate(date, year) {
  const weeks = getWeeksInYear(year)
  const match = weeks.find((week) => isDateInWeek(date, week))
  return match?.id ?? null
}

export function getConfiguredYearRange(referenceDate = new Date()) {
  const today = atNoon(referenceDate)
  const calendarYear = today.getFullYear()
  const weekId =
    findWeekIdForDate(today, calendarYear) ??
    findWeekIdForDate(today, calendarYear - 1) ??
    findWeekIdForDate(today, calendarYear + 1)
  let weekYear = calendarYear
  if (weekId) {
    const match = /^(\d{4})-W\d{2}$/.exec(weekId)
    if (match) weekYear = Number(match[1])
  }
  const max = Math.max(calendarYear, weekYear, YEAR_MIN)
  return {
    min: YEAR_MIN,
    max,
    default: weekYear >= YEAR_MIN ? weekYear : max,
  }
}

export function getAllConfiguredWeeks(referenceDate = new Date()) {
  const { min, max } = getConfiguredYearRange(referenceDate)
  const weeks = []
  for (let year = min; year <= max; year++) {
    weeks.push(...getWeeksInYear(year))
  }
  return weeks
}

/** 今天 12:00 本地；周结束日 < 今天 → 视为已结束的完整周 */
export function getLastCompletedWeek(referenceDate = new Date()) {
  const today = atNoon(referenceDate)
  const completed = getAllConfiguredWeeks(referenceDate).filter((w) => w.endDate < today)
  if (completed.length === 0) return null
  return completed[completed.length - 1]
}

export function getPreviousWeekId(weekId) {
  const all = getAllConfiguredWeeks()
  const idx = all.findIndex((w) => w.id === weekId)
  if (idx <= 0) return null
  return all[idx - 1].id
}

export function resolveWeekById(weekId) {
  const match = /^(\d{4})-W(\d{2})$/.exec(String(weekId || ''))
  if (!match) return null
  const year = Number(match[1])
  return getWeeksInYear(year).find((w) => w.id === weekId) || null
}

/**
 * 默认：仅「上一完整周」且 public 中缺价或价数据不完整。
 * --week=2026-W05 可显式指定；--dry-run 只打印计划。
 */
export function resolveWeeksToCollect(existingData, argv = process.argv) {
  const weekArg = argv.find((a) => a.startsWith('--week='))
  if (weekArg) {
    const id = weekArg.split('=')[1]
    const week = resolveWeekById(id)
    if (!week) throw new Error(`未知周 ID: ${id}`)
    return [week]
  }

  const last = getLastCompletedWeek()
  if (!last) {
    console.log('⚠️ 未找到已结束的周（可能日历未配置或日期过早）')
    return []
  }

  const existing = existingData[last.id]
  if (!existing) {
    console.log(`📋 ${last.id}: 无记录，需收集`)
    return [last]
  }

  if (weekNeedsPriceCollection(existing, last)) {
    console.log(`📋 ${last.id}: 价格数据不完整，需增量收集`)
    return [last]
  }

  console.log(`✅ ${last.id}: 价格数据已完整，跳过 API 收集`)
  return []
}

export function weekNeedsPriceCollection(weekData, weekDef) {
  if (!weekData?.rawData?.btc?.dates?.length || !weekData?.rawData?.eth?.dates?.length) {
    return true
  }

  const expectedDays = daysBetween(weekDef.startDate, weekDef.endDate)
  const btcComplete = weekData.rawData.btc.dates.length >= expectedDays
  const ethComplete = weekData.rawData.eth.dates.length >= expectedDays
  const hasChange = weekData.btcWeeklyChange !== undefined && weekData.btcWeeklyChange !== null
  const hasRatio = weekData.ethBtcRatio !== undefined && weekData.ethBtcRatio !== null

  return !(btcComplete && ethComplete && hasChange && hasRatio)
}

function daysBetween(start, end) {
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}
