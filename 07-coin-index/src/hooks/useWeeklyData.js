/**
 * 周数据管理 Hook
 * 统一管理所有周数据的加载和状态
 */

import { useState, useEffect, useMemo } from 'react'
import { loadAllWeeklyData } from '../utils/weeklyData'
import { logError } from '../utils/errorHandler'

/**
 * 使用周数据
 * @returns {{ allWeeklyData: Object, loading: boolean, error: Error|null, refetch: Function }}
 */
export function useWeeklyData() {
  const [allWeeklyData, setAllWeeklyData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await loadAllWeeklyData()
      setAllWeeklyData(data)
    } catch (err) {
      logError('useWeeklyData', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return {
    allWeeklyData,
    loading,
    error,
    refetch: fetchData
  }
}

/**
 * 按年份过滤周数据
 * @param {Object} allWeeklyData - 所有周数据
 * @param {number} year - 年份
 * @returns {Object} 指定年份的周数据
 */
export function useYearlyData(allWeeklyData, year) {
  return useMemo(() => {
    if (!allWeeklyData || !year) return {}
    
    return Object.keys(allWeeklyData)
      .filter(key => allWeeklyData[key].year === year)
      .reduce((acc, key) => {
        acc[key] = allWeeklyData[key]
        return acc
      }, {})
  }, [allWeeklyData, year])
}

/**
 * 获取选中周的数据
 * @param {Object} allWeeklyData - 所有周数据
 * @param {string} selectedWeek - 选中的周ID
 * @returns {Object} 选中周的数据
 */
export function useSelectedWeekData(allWeeklyData, selectedWeek) {
  return useMemo(() => {
    if (!allWeeklyData || !selectedWeek) return {}
    return allWeeklyData[selectedWeek] || {}
  }, [allWeeklyData, selectedWeek])
}
