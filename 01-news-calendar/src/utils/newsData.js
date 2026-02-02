import { formatDateKey } from './dateUtils'
import { newsAPI } from '../services/api'

// 加载指定月份的新闻数据 - 通过API获取
export async function loadMonthlyNewsData(date) {
  try {
    const response = await newsAPI.getAllNews()
    if (response.success) {
      return response.data
    } else {
      return {}
    }
  } catch (error) {
    console.error('通过API加载数据失败:', error)
    return {}
  }
}

// 加载新闻数据（保持向后兼容）
export async function loadNewsData() {
  return await loadMonthlyNewsData(new Date())
}

export async function getNewsForDate(date) {
  const dateKey = formatDateKey(date)
  try {
    const response = await newsAPI.getNewsByDate(dateKey)
    if (response.success) {
      return response.data
    } else {
      return {}
    }
  } catch (error) {
    console.error(`获取${dateKey}新闻失败:`, error)
    return {}
  }
}

export async function hasNewsForDate(date) {
  const news = await getNewsForDate(date)
  if (!news) return false
  return Object.values(news).some(categoryNews => 
    Array.isArray(categoryNews) && categoryNews.length > 0
  )
}