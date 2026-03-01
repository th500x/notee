import { useState, useEffect } from 'react'
import { loadMonthlyNewsData } from '../utils/newsData'

const NEWS_CATEGORIES = {
  world_politics: { title: '世界政治新闻', color: 'bg-red-100 text-red-800' },
  world_economy: { title: '世界经济新闻', color: 'bg-blue-100 text-blue-800' },
  asia_politics: { title: '亚洲政治新闻', color: 'bg-yellow-100 text-yellow-800' },
  asia_economy: { title: '亚洲经济新闻', color: 'bg-green-100 text-green-800' },
  thailand_politics: { title: '中泰政治新闻', color: 'bg-purple-100 text-purple-800' },
  thailand_society: { title: '中泰民生新闻', color: 'bg-pink-100 text-pink-800' }
}

function HotNews({ refreshTrigger }) {
  const [hotNews, setHotNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchHotNews = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const timestamp = Date.now()
      // 使用相对路径，自动适配域名
      const apiUrl = `/api/emoji/hot/ranking?t=${timestamp}`
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        cache: 'no-cache'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (!result.success || !result.data || result.data.length === 0) {
        setHotNews([])
        return
      }
      
      // 确定需要加载的月份
      const monthsNeeded = new Set()
      result.data.forEach(hotItem => {
        const parsedId = parseNewsId(hotItem.news_id)
        if (parsedId) {
          const date = new Date(parsedId.date)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          monthsNeeded.add(monthKey)
        }
      })
      
      // 加载所需月份的新闻数据
      let allNewsData = {}
      for (const monthKey of monthsNeeded) {
        const [year, month] = monthKey.split('-')
        const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1)
        
        try {
          const monthData = await loadMonthlyNewsData(monthDate)
          allNewsData = { ...allNewsData, ...monthData }
        } catch (error) {
          console.error(`Failed to load news data for ${monthKey}:`, error)
        }
      }
      
      // 解析newsId并匹配新闻内容
      const hotNewsWithContent = []
      
      for (const hotItem of result.data) {
        const parsedId = parseNewsId(hotItem.news_id)
        
        if (!parsedId) continue
        
        const { date, category, index } = parsedId
        const dayNews = allNewsData[date]
        
        if (!dayNews || !dayNews[category] || !dayNews[category][index]) continue
        
        const newsItem = dayNews[category][index]
        
        hotNewsWithContent.push({
          ...newsItem,
          newsId: hotItem.news_id,
          totalReactions: hotItem.total_reactions,
          topEmoji: hotItem.top_emoji || '🍺',
          emojiBreakdown: hotItem.emoji_breakdown || {},
          category: category,
          date: date,
          categoryInfo: NEWS_CATEGORIES[category]
        })
      }
      
      setHotNews(hotNewsWithContent)
      
    } catch (error) {
      console.error('[HotNews] 加载失败:', error)
      setError(error.message || '加载热门新闻失败')
      setHotNews([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHotNews()
  }, [refreshTrigger])

  // 解析newsId格式，支持新旧格式
  const parseNewsId = (newsId) => {
    try {
      // 新格式: "2026-01-31-thailand_politics-0"
      if (newsId.match(/^\d{4}-\d{2}-\d{2}-/)) {
        const parts = newsId.split('-')
        
        if (parts.length < 4) return null
        
        const index = parseInt(parts[parts.length - 1])
        const category = parts.slice(3, -1).join('-') || parts[3]
        const year = parts[0]
        const month = parts[1]
        const day = parts[2]
        const standardDate = `${year}-${month}-${day}`
        
        return { date: standardDate, category, index }
      }
      
      // 旧格式: "2026年1月30日星期五-world_economy-0"
      const lastDashIndex = newsId.lastIndexOf('-')
      if (lastDashIndex === -1) return null
      
      const index = parseInt(newsId.substring(lastDashIndex + 1))
      const remaining = newsId.substring(0, lastDashIndex)
      
      const secondLastDashIndex = remaining.lastIndexOf('-')
      if (secondLastDashIndex === -1) return null
      
      const category = remaining.substring(secondLastDashIndex + 1)
      const dateStr = remaining.substring(0, secondLastDashIndex)
      
      // 转换中文日期为标准格式
      const dateMatch = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
      if (!dateMatch) return null
      
      const year = dateMatch[1]
      const month = dateMatch[2].padStart(2, '0')
      const day = dateMatch[3].padStart(2, '0')
      const standardDate = `${year}-${month}-${day}`
      
      return { date: standardDate, category, index }
    } catch (error) {
      return null
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          🔥 Hot News This Month
        </h3>
        <div className="text-center py-4 text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          🔥 Hot News This Month
        </h3>
        <div className="text-center py-4">
          <svg className="w-8 h-8 text-red-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-600 text-sm mb-2">{error}</p>
          <button 
            onClick={fetchHotNews}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  if (hotNews.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          🔥 Hot News This Month
        </h3>
        <div className="text-center py-4 text-gray-500">
          <p className="text-sm">No hot news yet</p>
          <p className="text-xs mt-1">Be the first to react!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold mb-3 flex items-center">
        🔥 Hot News This Month
      </h3>
      
      <div className="space-y-3">
        {hotNews.slice(0, 3).map((news, index) => (
          <div key={news.newsId} className="border-l-4 border-orange-400 pl-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <span className="text-orange-500 font-bold text-sm">#{index + 1}</span>
                {news.categoryInfo && (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${news.categoryInfo.color}`}>
                    {news.categoryInfo.title}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <span>{news.topEmoji || '🍺'}</span>
                <span>{news.totalReactions}</span>
              </div>
            </div>
            
            <h4 className="font-medium text-gray-900 text-sm leading-tight mb-1">
              {news.link ? (
                <a 
                  href={news.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {news.title}
                </a>
              ) : (
                news.title
              )}
            </h4>
            
            {news.summary && (
              <p className="text-gray-600 text-xs leading-relaxed line-clamp-2">
                {news.summary}
              </p>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-3 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          Ranked by emoji reactions, earlier published wins for ties
        </p>
      </div>
    </div>
  )
}

export default HotNews