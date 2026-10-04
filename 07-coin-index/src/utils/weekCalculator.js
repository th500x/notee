/**
 * 周计算工具
 * 2025 为锚点（含跨年 W53）；2026 起由上一年最后一周结束日的次日连推周一～周日。
 */

import { SPECIAL_WEEKS, WEEK_LIMITS, YEAR_RANGE } from '../constants'

/** 避免 import weeklyData（其会再 import validation → 环形依赖） */
const formatWeekId = (year, weekNum) =>
  `${year}-W${String(weekNum).padStart(2, '0')}`

const atNoon = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)

const addDays = (date, days) => {
  const next = atNoon(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * 计算周数 (ISO 8601标准)
 * @param {Date} date - 日期
 * @returns {number} 周数
 */
export function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
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
  const prevLast = prev[prev.length - 1]
  let current = addDays(prevLast.endDate, 1)
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

/**
 * 获取某年的所有周
 * @param {number} year - 年份
 * @returns {Array<Object>} 周数组
 */
export function getWeeksInYear(year) {
  const y = Number(year)
  if (!Number.isInteger(y) || y < YEAR_RANGE.MIN) return []
  if (y === 2025) return getWeeksInYear2025()
  return deriveWeeksFromPreviousYear(y)
}

/**
 * 可切换/采数覆盖的年份范围（随「今天」自动延伸，无需人工改年）。
 * MAX = max(今天公历年, 今天所在周所属年)。
 */
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
  const max = Math.max(calendarYear, weekYear, YEAR_RANGE.MIN)
  return {
    min: YEAR_RANGE.MIN,
    max,
    default: weekYear >= YEAR_RANGE.MIN ? weekYear : max,
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

/**
 * 格式化为本地日历日（去掉时分秒，避免周末边界误判）
 */
export function toCalendarDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** 判断日期是否落在周的闭区间 [weekStart, weekEnd]（按日历日） */
export function isDateInWeek(date, week) {
  const day = toCalendarDay(date)
  const start = toCalendarDay(week.startDate)
  const end = toCalendarDay(week.endDate)
  return day >= start && day <= end
}

/**
 * 在当前年周列表中查找包含指定日期的周
 * @returns {string|null} weekId
 */
export function findWeekIdForDate(date, year) {
  const weeks = getWeeksInYear(year)
  const match = weeks.find((week) => isDateInWeek(date, week))
  return match?.id ?? null
}

/**
 * 格式化日期范围显示
 * @param {Date} startDate - 开始日期
 * @param {Date} endDate - 结束日期
 * @returns {string} 格式化的日期范围
 */
export function formatDateRange(startDate, endDate) {
  const start = `${(startDate.getMonth() + 1).toString().padStart(2, '0')}/${startDate.getDate().toString().padStart(2, '0')}`
  const end = `${(endDate.getMonth() + 1).toString().padStart(2, '0')}/${endDate.getDate().toString().padStart(2, '0')}`
  return `${start}-${end}`
}
