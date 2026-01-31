import { formatDateKey } from './dateUtils'

// 根据日期获取对应的月份文件名
function getMonthFileName(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `news_${year}${month}.json`
}

// 加载指定月份的新闻数据
export async function loadMonthlyNewsData(date) {
  const fileName = getMonthFileName(date)
  
  try {
    const response = await fetch(`/${fileName}?t=${Date.now()}`) // 添加时间戳避免缓存
    if (!response.ok) {
      console.log(`月份文件 ${fileName} 不存在，返回空数据`)
      return {}
    }
    
    const data = await response.json()
    console.log(`成功加载月份数据: ${fileName}`)
    return data
  } catch (error) {
    console.error(`加载月份数据失败 ${fileName}:`, error)
    return {}
  }
}

// 加载新闻数据（保持向后兼容）
export async function loadNewsData() {
  // 默认加载当前月份的数据
  return await loadMonthlyNewsData(new Date())
}

export async function getNewsForDate(date) {
  const newsData = await loadMonthlyNewsData(date)
  const dateKey = formatDateKey(date)
  const result = newsData[dateKey] || {}
  console.log(`获取${dateKey}的新闻:`, result)
  return result
}

export async function hasNewsForDate(date) {
  const newsData = await loadMonthlyNewsData(date)
  const dateKey = formatDateKey(date)
  const news = newsData[dateKey]
  if (!news) return false
  
  return Object.values(news).some(categoryNews => 
    Array.isArray(categoryNews) && categoryNews.length > 0
  )
}