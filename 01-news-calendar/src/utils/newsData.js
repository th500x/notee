import { formatDateKey } from './dateUtils'
import { newsAPI } from '../services/api'
import SimpleCache from './cache'
import { CACHE_CONSTANTS, LOG_PREFIX } from '../constants'

// 创建缓存实例
const cache = new SimpleCache(CACHE_CONSTANTS.MAX_SIZE, CACHE_CONSTANTS.DURATION)

/**
 * 加载指定月份的新闻数据 - 通过API获取（带缓存）
 * 
 * @param {Date} date - 日期对象
 * @returns {Promise<Object>} 新闻数据对象，格式为 { "YYYY-MM-DD": { category: [...] } }
 * @throws {Error} 当加载失败且无缓存时抛出错误
 * 
 * @example
 * const news = await loadMonthlyNewsData(new Date(2026, 0, 1))
 * console.log(news['2026-01-01'])
 */
export async function loadMonthlyNewsData(date) {
  const cacheKey = CACHE_CONSTANTS.KEY_PREFIX.ALL_NEWS
  
  // 检查缓存
  const cached = cache.get(cacheKey)
  if (cached) {
    console.log(`${LOG_PREFIX.NEWS_DATA} 从缓存加载所有新闻`)
    return cached
  }
  
  try {
    console.log(`${LOG_PREFIX.NEWS_DATA} 从API加载所有新闻`)
    const response = await newsAPI.getAllNews()
    
    if (!response.success) {
      throw new Error(response.error || '加载新闻数据失败')
    }
    
    // 存入缓存
    cache.set(cacheKey, response.data)
    return response.data
  } catch (error) {
    console.error(`${LOG_PREFIX.NEWS_DATA} 加载失败:`, error)
    throw new Error(`加载新闻数据失败: ${error.message}`)
  }
}

/**
 * 加载新闻数据（保持向后兼容）
 * 
 * @returns {Promise<Object>} 新闻数据对象
 * @throws {Error} 当加载失败时抛出错误
 */
export async function loadNewsData() {
  return await loadMonthlyNewsData(new Date())
}

/**
 * 获取指定日期的新闻（带缓存）
 * 
 * @param {Date} date - 日期对象
 * @returns {Promise<Object>} 该日期的新闻数据，格式为 { category: [...] }
 * @throws {Error} 当加载失败时抛出错误
 * 
 * @example
 * const news = await getNewsForDate(new Date(2026, 0, 1))
 * console.log(news.world_politics) // 世界政治新闻数组
 */
export async function getNewsForDate(date) {
  const dateKey = formatDateKey(date)
  const cacheKey = `${CACHE_CONSTANTS.KEY_PREFIX.NEWS_BY_DATE}${dateKey}`
  
  // 检查缓存
  const cached = cache.get(cacheKey)
  if (cached) {
    console.log(`${LOG_PREFIX.NEWS_DATA} 从缓存加载 ${dateKey}`)
    return cached
  }
  
  try {
    console.log(`${LOG_PREFIX.NEWS_DATA} 从API加载 ${dateKey}`)
    const response = await newsAPI.getNewsByDate(dateKey)
    
    if (!response.success) {
      throw new Error(response.error || `获取${dateKey}新闻失败`)
    }
    
    // 存入缓存
    cache.set(cacheKey, response.data)
    return response.data
  } catch (error) {
    console.error(`${LOG_PREFIX.NEWS_DATA} 获取${dateKey}新闻失败:`, error)
    throw new Error(`获取${dateKey}新闻失败: ${error.message}`)
  }
}

/**
 * 检查指定日期是否有新闻
 * 
 * @param {Date} date - 日期对象
 * @returns {Promise<boolean>} 是否有新闻
 */
export async function hasNewsForDate(date) {
  try {
    const news = await getNewsForDate(date)
    if (!news) return false
    return Object.values(news).some(categoryNews => 
      Array.isArray(categoryNews) && categoryNews.length > 0
    )
  } catch (error) {
    console.error(`${LOG_PREFIX.NEWS_DATA} 检查新闻失败:`, error)
    return false
  }
}

/**
 * 清除缓存（用于刷新数据）
 */
export function clearCache() {
  cache.clear()
  console.log(`${LOG_PREFIX.NEWS_DATA} 缓存已清除`)
}