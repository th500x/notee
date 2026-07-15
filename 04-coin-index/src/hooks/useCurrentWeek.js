/**
 * 当前周定位 Hook
 * 自动定位到当前周
 */

import { useState, useEffect } from 'react'
import { SPECIAL_WEEKS } from '../constants'
import { getWeeksInYear } from '../utils/weekCalculator'
import { logDebug } from '../utils/errorHandler'

/**
 * 获取当前周ID
 * @returns {string} 当前周ID
 */
function getCurrentWeekId() {
  // 使用真实的当前日期
  const testDate = new Date()
  
  // 检查2025年W53 (跨年周)
  const week2025W53 = SPECIAL_WEEKS['2025-W53']
  if (testDate >= week2025W53.start && testDate <= week2025W53.end) {
    return '2025-W53'
  }
  
  // 检查2026年的所有周
  const weeks2026 = getWeeksInYear(2026)
  
  for (const week of weeks2026) {
    const weekStart = new Date(week.startDate.getFullYear(), week.startDate.getMonth(), week.startDate.getDate())
    const weekEnd = new Date(week.endDate.getFullYear(), week.endDate.getMonth(), week.endDate.getDate())
    
    if (testDate >= weekStart && testDate <= weekEnd) {
      logDebug('useCurrentWeek', `找到当前周: ${week.id}`, {
        testDate: testDate.toLocaleDateString(),
        weekStart: weekStart.toLocaleDateString(),
        weekEnd: weekEnd.toLocaleDateString()
      })
      return week.id
    }
  }
  
  // 如果在2026年之外，检查2025年
  const weeks2025 = getWeeksInYear(2025)
  for (const week of weeks2025) {
    const weekStart = new Date(week.startDate.getFullYear(), week.startDate.getMonth(), week.startDate.getDate())
    const weekEnd = new Date(week.endDate.getFullYear(), week.endDate.getMonth(), week.endDate.getDate())
    
    if (testDate >= weekStart && testDate <= weekEnd) {
      logDebug('useCurrentWeek', `找到当前周: ${week.id}`)
      return week.id
    }
  }
  
  // 默认返回2026-W01
  logDebug('useCurrentWeek', '未找到匹配的周，返回默认2026-W01')
  return '2026-W01'
}

/**
 * 使用当前周
 * @returns {string} 当前周ID
 */
export function useCurrentWeek() {
  const [currentWeekId, setCurrentWeekId] = useState('')

  useEffect(() => {
    const weekId = getCurrentWeekId()
    setCurrentWeekId(weekId)
    logDebug('useCurrentWeek', `设置初始选中周: ${weekId}`)
  }, [])

  return currentWeekId
}
