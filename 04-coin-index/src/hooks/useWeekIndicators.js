/**
 * 周指示器 Hook
 * 管理周历中的数据指示器（红绿点）
 */

import { useState, useEffect } from 'react'
import { hasDataForWeek, getWeeklyData, getWeekTrend } from '../utils/weeklyData'
import { formatWeekId } from '../utils/weeklyData'
import { YEAR_RANGE, WEEK_LIMITS } from '../constants'
import { logError } from '../utils/errorHandler'

/**
 * 使用周指示器
 * @param {number} currentYear - 当前年份
 * @returns {{ weekIndicators: Set, weekStatuses: Object, loading: boolean }}
 */
export function useWeekIndicators(currentYear) {
  const [weekIndicators, setWeekIndicators] = useState(new Set())
  const [weekStatuses, setWeekStatuses] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkYearData = async () => {
      try {
        setLoading(true)
        const indicators = new Set()
        const statuses = {}
        
        // 并行检查所有周
        const checkPromises = []
        for (let week = WEEK_LIMITS.MIN_WEEK; week <= WEEK_LIMITS.MAX_WEEKS; week++) {
          const weekId = formatWeekId(currentYear, week)
          checkPromises.push(
            hasDataForWeek(weekId).then(hasData => ({ weekId, hasData }))
          )
        }
        
        const results = await Promise.all(checkPromises)
        
        // 收集有数据的周
        const weeksWithData = results
          .filter(({ hasData }) => hasData)
          .map(({ weekId }) => weekId)
        
        weeksWithData.forEach(weekId => indicators.add(weekId))
        
        // 并行加载周状态
        const statusPromises = weeksWithData.map(async (weekId) => {
          try {
            const weekData = await getWeeklyData(weekId)
            const status = getWeekTrend(weekData)
            return { weekId, status }
          } catch (error) {
            logError('useWeekIndicators', error, { weekId })
            return null
          }
        })
        
        const statusResults = await Promise.all(statusPromises)
        
        statusResults.forEach(result => {
          if (result && result.status) {
            statuses[result.weekId] = result.status
          }
        })
        
        setWeekIndicators(indicators)
        setWeekStatuses(statuses)
      } catch (error) {
        logError('useWeekIndicators', error, { currentYear })
      } finally {
        setLoading(false)
      }
    }
    
    if (currentYear >= YEAR_RANGE.MIN && currentYear <= YEAR_RANGE.MAX) {
      checkYearData()
    }
  }, [currentYear])

  return {
    weekIndicators,
    weekStatuses,
    loading
  }
}
