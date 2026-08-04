/**
 * 当前周定位 Hook
 * 自动定位到当前周（与 weekCalculator 自定义周历一致）
 */

import { useState, useEffect } from 'react'
import { SPECIAL_WEEKS } from '../constants'
import { findWeekIdForDate } from '../utils/weekCalculator'
import { logDebug } from '../utils/errorHandler'

/**
 * 获取当前周ID
 * @returns {string} 当前周ID，未匹配时返回空字符串
 */
function getCurrentWeekId() {
  const today = new Date()

  const week2025W53 = SPECIAL_WEEKS['2025-W53']
  if (today >= week2025W53.start && today <= week2025W53.end) {
    return '2025-W53'
  }

  const year = today.getFullYear()
  const weekId =
    findWeekIdForDate(today, year) ??
    findWeekIdForDate(today, year - 1) ??
    findWeekIdForDate(today, year + 1)

  if (weekId) {
    logDebug('useCurrentWeek', `找到当前周: ${weekId}`, {
      testDate: today.toLocaleDateString(),
    })
    return weekId
  }

  logDebug('useCurrentWeek', '未找到匹配的周')
  return ''
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
    logDebug('useCurrentWeek', `设置当前周高亮: ${weekId || '(无)'}`)
  }, [])

  return currentWeekId
}
