import { useState, useEffect } from 'react'
import { loadMonthlyNewsData } from '../utils/newsData'
import { formatDateKey } from '../utils/dateUtils'

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

  const fetchHotNews = async () => {
    try {
      setLoading(true)
      
      // Get hot news ranking with timestamp to avoid cache
      const timestamp = Date.now()
      const apiUrl = `http://47.113.185.170:3001/api/emoji/hot/ranking?t=${timestamp}`
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        cache: 'no-cache'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        console.error('Get hot news failed:', result.error)
        setHotNews([])
        return
      }
      
      // Check if data is empty
      if (!result.data || result.data.length === 0) {
        setHotNews([])
        return
      }
      
      // Determine which months we need based on the newsIds
      const monthsNeeded = new Set()
      result.data.forEach(hotItem => {
        const newsId = hotItem.news_id
        const parsedId = parseNewsId(newsId)
        if (parsedId) {
          const date = new Date(parsedId.date)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          monthsNeeded.add(monthKey)
        }
      })
      
      // Load news data for all needed months
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
      
      // Parse newsId and match news content
      const hotNewsWithContent = []
      
      for (let i = 0; i < result.data.length; i++) {
        const hotItem = result.data[i]
        const newsId = hotItem.news_id
        
        const parsedId = parseNewsId(newsId)
        
        if (!parsedId) {
          continue
        }
        
        const { date, category, index } = parsedId
        const dayNews = allNewsData[date]
        
        if (!dayNews || !dayNews[category] || !dayNews[category][index]) {
          continue
        }
        
        const newsItem = dayNews[category][index]
        
        hotNewsWithContent.push({
          ...newsItem,
          newsId: newsId,
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
      console.error('Fetch hot news failed:', error)
      setHotNews([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHotNews()
  }, [refreshTrigger])

  // Parse newsId format, support both old and new formats
  const parseNewsId = (newsId) => {
    try {
      // Check if it's new format: "2026-01-31-thailand_politics-0"
      if (newsId.match(/^\d{4}-\d{2}-\d{2}-/)) {
        const parts = newsId.split('-')
        
        if (parts.length < 4) {
          return null
        }
        
        const index = parseInt(parts[parts.length - 1])
        const category = parts.slice(3, -1).join('-') || parts[3]
        const year = parts[0]
        const month = parts[1]
        const day = parts[2]
        const standardDate = `${year}-${month}-${day}`
        
        return { date: standardDate, category, index }
      }
      
      // Handle old format: "2026年1月30日星期五-world_economy-0"
      const lastDashIndex = newsId.lastIndexOf('-')
      if (lastDashIndex === -1) {
        return null
      }
      
      const index = parseInt(newsId.substring(lastDashIndex + 1))
      const remaining = newsId.substring(0, lastDashIndex)
      
      const secondLastDashIndex = remaining.lastIndexOf('-')
      if (secondLastDashIndex === -1) {
        return null
      }
      
      const category = remaining.substring(secondLastDashIndex + 1)
      const dateStr = remaining.substring(0, secondLastDashIndex)
      
      // Convert Chinese date to standard format
      const dateMatch = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
      if (!dateMatch) {
        return null
      }
      
      const year = dateMatch[1]
      const month = dateMatch[2].padStart(2, '0')
      const day = dateMatch[3].padStart(2, '0')
      const standardDate = `${year}-${month}-${day}`
      
      return { date: standardDate, category, index }
    } catch (error) {
      console.error('Parse newsId failed:', newsId, error)
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