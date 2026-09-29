import { formatDateKey, isDateInRange } from './dateUtils'
import SimpleCache from './cache'
import { CACHE_CONSTANTS, LOG_PREFIX, DATE_CONSTANTS } from '../constants'

const cache = new SimpleCache(CACHE_CONSTANTS.MAX_SIZE, CACHE_CONSTANTS.DURATION)

function validateDateRange(date) {
  if (!isDateInRange(date, DATE_CONSTANTS.MIN_DATE, DATE_CONSTANTS.MAX_DATE)) {
    throw new RangeError(
      `日期超出有效范围 (${DATE_CONSTANTS.MIN_DATE.toLocaleDateString()} - ${DATE_CONSTANTS.MAX_DATE.toLocaleDateString()})`
    )
  }
}

function listMonthKeys(minDate, maxDate) {
  const keys = []
  const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)
  while (cursor <= end) {
    const year = cursor.getFullYear()
    const month = String(cursor.getMonth() + 1).padStart(2, '0')
    keys.push(`${year}${month}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return keys
}

async function readStaticNews() {
  const base = import.meta.env.BASE_URL || '/'
  const keys = listMonthKeys(DATE_CONSTANTS.MIN_DATE, DATE_CONSTANTS.MAX_DATE)
  const allNews = {}
  let loaded = 0

  for (const key of keys) {
    const url = `${base}news-calendar-${key}.json`
    const response = await fetch(url)
    if (!response.ok) {
      continue
    }
    const monthNews = await response.json()
    Object.assign(allNews, monthNews)
    loaded += 1
  }

  if (loaded === 0) {
    throw new Error('没有读到任何月份的新闻文件')
  }

  return allNews
}

export async function loadMonthlyNewsData(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new TypeError('Invalid date parameter: expected a valid Date object')
  }

  const cacheKey = CACHE_CONSTANTS.KEY_PREFIX.ALL_NEWS
  const cached = cache.get(cacheKey)
  if (cached) {
    console.log(`${LOG_PREFIX.NEWS_DATA} 从缓存加载所有新闻`)
    return cached
  }

  try {
    console.log(`${LOG_PREFIX.NEWS_DATA} 从静态 JSON 加载所有新闻`)
    const data = await readStaticNews()
    cache.set(cacheKey, data)
    return data
  } catch (error) {
    console.error(`${LOG_PREFIX.NEWS_DATA} 加载失败:`, error)
    const errorMessage = import.meta.env.PROD
      ? '加载新闻数据失败，请稍后重试'
      : `加载新闻数据失败: ${error.message}`
    throw new Error(errorMessage)
  }
}

export async function loadNewsData() {
  return await loadMonthlyNewsData(new Date())
}

export async function getNewsForDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new TypeError('Invalid date parameter: expected a valid Date object')
  }

  validateDateRange(date)

  const dateKey = formatDateKey(date)
  const cacheKey = `${CACHE_CONSTANTS.KEY_PREFIX.NEWS_BY_DATE}${dateKey}`
  const cached = cache.get(cacheKey)
  if (cached) {
    return cached
  }

  const allNews = await loadNewsData()
  const dayNews = allNews[dateKey] || {}
  cache.set(cacheKey, dayNews)
  return dayNews
}

export async function hasNewsForDate(date) {
  try {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return false
    }
    const news = await getNewsForDate(date)
    if (!news) return false
    return Object.values(news).some(
      (categoryNews) => Array.isArray(categoryNews) && categoryNews.length > 0
    )
  } catch (error) {
    console.error(`${LOG_PREFIX.NEWS_DATA} 检查新闻失败:`, error)
    return false
  }
}

export function clearCache() {
  cache.clear()
}
