/**
 * 周数据处理工具函数 - v4.0
 * 支持真实API数据，添加输入验证和统一错误处理
 */

import { config } from '../config'
import { DATA_PATHS } from '../constants'
import { validateWeekId, validateYear, isValidWeekId } from './validation'
import { handleDataLoad, logDebug, logWarning, logError } from './errorHandler'

// 数据缓存
let realWeeklyData = {}
let dataLoadPromise = null

/**
 * 异步加载真实数据
 * @returns {Promise<boolean>} 加载成功返回true
 */
const loadRealData = async () => {
  return handleDataLoad(async () => {
    const paths = config.data.fallbackPaths
    
    for (const path of paths) {
      try {
        logDebug('DataLoader', `尝试加载数据: ${path}`)
        
        const response = await fetch(path)
        if (response.ok) {
          realWeeklyData = await response.json()
          logDebug('DataLoader', `已加载真实周数据: ${Object.keys(realWeeklyData).length}周`, { source: path })
          return true
        }
      } catch (error) {
        logDebug('DataLoader', `路径 ${path} 加载失败: ${error.message}`)
      }
    }
    
    logWarning('DataLoader', '所有路径都失败，将使用模拟数据')
    return false
  }, 'loadRealData')
}

/**
 * 确保数据已加载
 * @returns {Promise<void>}
 */
export const ensureDataLoaded = async () => {
  if (!dataLoadPromise) {
    dataLoadPromise = loadRealData()
  }
  await dataLoadPromise
}

// 模拟数据（开发环境回退使用）
const mockWeeklyData = {
  '2025-W53': {
    weekId: '2025-W53',
    year: 2025,
    weekNumber: 53,
    weekStart: '2025-12-29',
    weekEnd: '2026-01-04',
    btcWeeklyChange: 3.8,
    btcWeeklyAvgPrice: 98750,
    ethWeeklyAvgPrice: 3420,
    fearGreedIndex: 55,
    mayerMultiple: 1.95,
    ahr999: 1.05,
    ethBtcRatio: 0.041,
    btcFromATH: -12.3,
    marketTrend: 'bullish',
    updatedAt: '2026-01-04T23:59:59Z'
  },
  '2026-W01': {
    weekId: '2026-W01',
    year: 2026,
    weekNumber: 1,
    weekStart: '2026-01-05',
    weekEnd: '2026-01-11',
    btcWeeklyChange: -5.2,
    btcWeeklyAvgPrice: 95420,
    ethWeeklyAvgPrice: 3280,
    fearGreedIndex: 25,
    mayerMultiple: 1.8,
    ahr999: 0.85,
    ethBtcRatio: 0.042,
    btcFromATH: -15.5,
    marketTrend: 'bearish',
    updatedAt: '2026-01-11T23:59:59Z'
  },
  '2026-W02': {
    weekId: '2026-W02',
    year: 2026,
    weekNumber: 2,
    weekStart: '2026-01-12',
    weekEnd: '2026-01-18',
    btcWeeklyChange: 8.7,
    btcWeeklyAvgPrice: 103750,
    ethWeeklyAvgPrice: 3565,
    fearGreedIndex: 65,
    mayerMultiple: 2.1,
    ahr999: 1.15,
    ethBtcRatio: 0.045,
    btcFromATH: -8.2,
    marketTrend: 'bullish',
    updatedAt: '2026-01-18T23:59:59Z'
  },
  '2026-W03': {
    weekId: '2026-W03',
    year: 2026,
    weekNumber: 3,
    weekStart: '2026-01-19',
    weekEnd: '2026-01-25',
    btcWeeklyChange: -2.1,
    btcWeeklyAvgPrice: 101580,
    ethWeeklyAvgPrice: 3490,
    fearGreedIndex: 45,
    mayerMultiple: 1.9,
    ahr999: 0.95,
    ethBtcRatio: 0.043,
    btcFromATH: -10.1,
    marketTrend: 'bearish',
    updatedAt: '2026-01-25T23:59:59Z'
  },
  '2026-W04': {
    weekId: '2026-W04',
    year: 2026,
    weekNumber: 4,
    weekStart: '2026-01-26',
    weekEnd: '2026-02-01',
    btcWeeklyChange: 2.3,
    btcWeeklyAvgPrice: 104200,
    ethWeeklyAvgPrice: 3620,
    fearGreedIndex: 58,
    mayerMultiple: 2.0,
    ahr999: 1.08,
    ethBtcRatio: 0.044,
    btcFromATH: -7.5,
    marketTrend: 'bullish',
    updatedAt: '2026-02-01T23:59:59Z'
  },
  '2026-W52': {
    weekId: '2026-W52',
    year: 2026,
    weekNumber: 52,
    weekStart: '2026-12-28',
    weekEnd: '2027-01-03',
    btcWeeklyChange: 4.5,
    btcWeeklyAvgPrice: 125680,
    ethWeeklyAvgPrice: 4250,
    fearGreedIndex: 78,
    mayerMultiple: 2.3,
    ahr999: 1.35,
    ethBtcRatio: 0.048,
    btcFromATH: -2.8,
    marketTrend: 'bullish',
    updatedAt: '2027-01-03T23:59:59Z'
  }
}

/**
 * 获取数据源（真实数据或模拟数据）
 * @returns {Object} 数据源对象
 */
const getDataSource = () => {
  const hasRealData = Object.keys(realWeeklyData).length > 0
  
  // 生产环境只使用真实数据
  if (!config.features.enableMockData) {
    return realWeeklyData
  }
  
  // 开发环境回退到模拟数据
  return hasRealData ? realWeeklyData : mockWeeklyData
}

/**
 * 加载指定年份的所有周数据
 * @param {number} year - 年份
 * @returns {Promise<Object>} 年份数据对象
 */
export const loadWeeklyData = async (year) => {
  return handleDataLoad(async () => {
    // 验证年份
    validateYear(year)
    
    // 确保数据已加载
    await ensureDataLoaded()
    
    const dataSource = getDataSource()
    
    // 过滤出指定年份的数据
    const yearData = {}
    Object.keys(dataSource).forEach(weekId => {
      if (dataSource[weekId].year === year) {
        yearData[weekId] = dataSource[weekId]
      }
    })
    
    logDebug('DataLoader', `加载 ${year} 年数据: ${Object.keys(yearData).length}周`)
    return yearData
  }, `loadWeeklyData(${year})`)
}

/**
 * 加载所有年份的数据
 * @returns {Promise<Object>} 所有数据对象
 */
export const loadAllWeeklyData = async () => {
  return handleDataLoad(async () => {
    await ensureDataLoaded()
    
    const dataSource = getDataSource()
    const isRealData = Object.keys(realWeeklyData).length > 0
    
    logDebug('DataLoader', `加载所有数据: ${Object.keys(dataSource).length}周`, {
      source: isRealData ? '真实数据' : '模拟数据'
    })
    
    return dataSource
  }, 'loadAllWeeklyData')
}

/**
 * 获取指定周的数据
 * @param {string} weekId - 周ID，格式：YYYY-WNN
 * @returns {Promise<Object|null>} 周数据对象，不存在返回null
 */
export const getWeeklyData = async (weekId) => {
  return handleDataLoad(async () => {
    // 验证weekId格式
    validateWeekId(weekId)
    
    // 确保数据已加载
    await ensureDataLoaded()
    
    const dataSource = getDataSource()
    const data = dataSource[weekId]
    
    if (!data) {
      logWarning('DataLoader', `周数据不存在: ${weekId}`)
      return null
    }
    
    const isRealData = realWeeklyData[weekId] !== undefined
    logDebug('DataLoader', `获取周数据: ${weekId}`, {
      source: isRealData ? '真实数据' : '模拟数据'
    })
    
    return data
  }, `getWeeklyData(${weekId})`)
}

/**
 * 检查指定周是否有数据
 * @param {string} weekId - 周ID
 * @returns {Promise<boolean>} 有数据返回true
 */
export const hasDataForWeek = async (weekId) => {
  try {
    // 验证weekId格式（不抛出错误）
    if (!isValidWeekId(weekId)) {
      return false
    }
    
    await ensureDataLoaded()
    const dataSource = getDataSource()
    return !!dataSource[weekId]
  } catch (error) {
    logError('DataLoader', error, { weekId })
    return false
  }
}

/**
 * 获取周的涨跌状态
 * @param {Object} weekData - 周数据对象
 * @returns {string|null} 'bullish' | 'bearish' | null
 */
export const getWeekTrend = (weekData) => {
  if (!weekData || weekData.btcWeeklyChange === null || weekData.btcWeeklyChange === undefined) {
    return null
  }
  return weekData.btcWeeklyChange >= 0 ? 'bullish' : 'bearish'
}

/**
 * 格式化周ID
 * @param {number} year - 年份
 * @param {number} weekNumber - 周数
 * @returns {string} 格式化的周ID
 */
export const formatWeekId = (year, weekNumber) => {
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`
}

/**
 * 解析周ID
 * @param {string} weekId - 周ID
 * @returns {{ year: number, weekNumber: number }} 解析结果
 */
export const parseWeekId = (weekId) => {
  const { year, week } = validateWeekId(weekId)
  return {
    year,
    weekNumber: week
  }
}

/**
 * 获取当前周ID (UTC+8时区)
 * @returns {string} 当前周ID
 */
export const getCurrentWeekId = () => {
  const now = new Date()
  // 转换为UTC+8时间
  const utc8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000))
  const year = utc8Time.getFullYear()
  
  // 计算周数 (ISO 8601标准)
  const d = new Date(Date.UTC(utc8Time.getFullYear(), utc8Time.getMonth(), utc8Time.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  
  return formatWeekId(year, weekNumber)
}

/**
 * 获取周的日期范围
 * @param {number} year - 年份
 * @param {number} weekNumber - 周数
 * @returns {{ start: Date, end: Date }} 日期范围
 */
export const getWeekDateRange = (year, weekNumber) => {
  validateYear(year)
  
  const firstDay = new Date(year, 0, 1)
  let currentMonday = new Date(firstDay)
  
  // 找到第一周的周一
  const dayOfWeek = firstDay.getDay()
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  currentMonday.setDate(firstDay.getDate() + daysToMonday)
  
  // 移动到指定周
  currentMonday.setDate(currentMonday.getDate() + (weekNumber - 1) * 7)
  
  const weekEnd = new Date(currentMonday)
  weekEnd.setDate(currentMonday.getDate() + 6)
  
  return {
    start: currentMonday,
    end: weekEnd
  }
}
