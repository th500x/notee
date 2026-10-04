/**
 * 输入验证工具
 * 提供统一的输入验证函数
 */

import { YEAR_RANGE, WEEK_LIMITS, FORMAT } from '../constants'
import { getConfiguredYearRange, getWeeksInYear } from './weekCalculator'

/**
 * 验证周ID格式
 * @param {string} weekId - 周ID，格式：YYYY-WNN
 * @returns {{ year: number, week: number }} 解析后的年份和周数
 * @throws {Error} 格式无效时抛出错误
 */
export function validateWeekId(weekId) {
  if (!weekId || typeof weekId !== 'string') {
    throw new Error('weekId必须是字符串')
  }
  
  const match = weekId.match(FORMAT.WEEK_ID_PATTERN)
  
  if (!match) {
    throw new Error(`无效的weekId格式: ${weekId}，应为YYYY-WNN格式（如：2026-W06）`)
  }
  
  const year = parseInt(match[1], 10)
  const week = parseInt(match[2], 10)
  const range = getConfiguredYearRange()
  // 允许已配置年内的周，以及算法能推出的更早锚点年之后的周（采数显式 --week= 可指向刚延伸出的年）
  if (year < YEAR_RANGE.MIN) {
    throw new Error(`年份超出范围: ${year}，应 >= ${YEAR_RANGE.MIN}`)
  }
  if (week < WEEK_LIMITS.MIN_WEEK || week > WEEK_LIMITS.MAX_WEEKS) {
    throw new Error(`周数超出范围: ${week}，应在${WEEK_LIMITS.MIN_WEEK}-${WEEK_LIMITS.MAX_WEEKS}之间`)
  }
  const yearWeeks = getWeeksInYear(year)
  if (!yearWeeks.some((item) => item.weekNumber === week)) {
    throw new Error(`无效周: ${weekId}（${year} 年周历无此周；当前可切换至 ${range.max}）`)
  }

  return { year, week }
}

/**
 * 验证年份
 * @param {number} year - 年份
 * @returns {boolean} 验证通过返回true
 * @throws {Error} 验证失败时抛出错误
 */
export function validateYear(year) {
  if (typeof year !== 'number' || !Number.isInteger(year)) {
    throw new Error('year必须是整数')
  }
  
  const range = getConfiguredYearRange()
  if (year < range.min || year > range.max) {
    throw new Error(`年份超出范围: ${year}，应在${range.min}-${range.max}之间`)
  }

  return true
}

/**
 * 验证周数据结构
 * @param {Object} data - 周数据对象
 * @returns {boolean} 验证通过返回true
 * @throws {Error} 验证失败时抛出错误
 */
export function validateWeekData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('周数据必须是对象')
  }
  
  const requiredFields = [
    'weekId', 'year', 'weekNumber', 'weekStart', 'weekEnd',
    'btcWeeklyChange', 'btcWeeklyAvgPrice', 'ethWeeklyAvgPrice'
  ]
  
  for (const field of requiredFields) {
    if (!(field in data)) {
      throw new Error(`缺少必需字段: ${field}`)
    }
  }
  
  // 验证数值类型
  const numericFields = ['year', 'weekNumber', 'btcWeeklyChange', 'btcWeeklyAvgPrice', 'ethWeeklyAvgPrice']
  for (const field of numericFields) {
    if (typeof data[field] !== 'number') {
      throw new Error(`${field}必须是数字，当前类型: ${typeof data[field]}`)
    }
  }
  
  // 验证字符串类型
  const stringFields = ['weekId', 'weekStart', 'weekEnd']
  for (const field of stringFields) {
    if (typeof data[field] !== 'string') {
      throw new Error(`${field}必须是字符串，当前类型: ${typeof data[field]}`)
    }
  }
  
  return true
}

/**
 * 安全地验证weekId（不抛出错误）
 * @param {string} weekId - 周ID
 * @returns {boolean} 验证通过返回true，否则返回false
 */
export function isValidWeekId(weekId) {
  try {
    validateWeekId(weekId)
    return true
  } catch (error) {
    return false
  }
}

/**
 * 安全地验证year（不抛出错误）
 * @param {number} year - 年份
 * @returns {boolean} 验证通过返回true，否则返回false
 */
export function isValidYear(year) {
  try {
    validateYear(year)
    return true
  } catch (error) {
    return false
  }
}
