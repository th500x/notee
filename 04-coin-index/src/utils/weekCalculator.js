/**
 * 周计算工具
 * 处理周数计算和日期范围
 */

import { SPECIAL_WEEKS, SPECIAL_WEEKS_2026, WEEK_LIMITS } from '../constants'
import { formatWeekId } from './weeklyData'

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

/**
 * 获取某年的所有周
 * @param {number} year - 年份
 * @returns {Array<Object>} 周数组
 */
export function getWeeksInYear(year) {
  const weeks = []
  
  if (year === 2025) {
    // 2025年：标准52周 + 跨年W53
    const startDate = new Date(year, 0, 1)
    let currentDate = new Date(startDate)
    
    // 调整到周一
    const dayOfWeek = currentDate.getDay()
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    currentDate.setDate(currentDate.getDate() + daysToMonday)
    
    // 生成前52周
    for (let weekNum = 1; weekNum <= WEEK_LIMITS.STANDARD_WEEKS; weekNum++) {
      const weekEnd = new Date(currentDate)
      weekEnd.setDate(currentDate.getDate() + 6)
      
      weeks.push({
        id: formatWeekId(year, weekNum),
        weekNumber: weekNum,
        startDate: new Date(currentDate),
        endDate: new Date(weekEnd),
        year
      })
      
      currentDate.setDate(currentDate.getDate() + 7)
    }
    
    // 添加跨年W53
    const w53 = SPECIAL_WEEKS['2025-W53']
    weeks.push({
      id: '2025-W53',
      weekNumber: 53,
      startDate: new Date(w53.start),
      endDate: new Date(w53.end),
      year: 2025
    })
    
  } else if (year === 2026) {
    // 2026年：特殊W1-W4 + 标准W5-W51 + 跨年W52
    
    // 添加特殊的前4周
    SPECIAL_WEEKS_2026.forEach(week => {
      const startDate = new Date(week.start.getFullYear(), week.start.getMonth(), week.start.getDate(), 12, 0, 0)
      const endDate = new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 12, 0, 0)
      
      weeks.push({
        id: formatWeekId(year, week.num),
        weekNumber: week.num,
        startDate: startDate,
        endDate: endDate,
        year
      })
    })
    
    // 从第5周开始按正常逻辑计算到第51周
    let currentDate = new Date(2026, 1, 2, 12, 0, 0) // 2月2日开始 (W5)
    for (let weekNum = 5; weekNum <= 51; weekNum++) {
      const weekEnd = new Date(currentDate)
      weekEnd.setDate(currentDate.getDate() + 6)
      
      weeks.push({
        id: formatWeekId(year, weekNum),
        weekNumber: weekNum,
        startDate: new Date(currentDate),
        endDate: new Date(weekEnd),
        year
      })
      
      currentDate.setDate(currentDate.getDate() + 7)
    }
    
    // 添加跨年W52
    const w52 = SPECIAL_WEEKS['2026-W52']
    weeks.push({
      id: '2026-W52',
      weekNumber: 52,
      startDate: new Date(w52.start),
      endDate: new Date(w52.end),
      year: 2026
    })
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
