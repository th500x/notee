import { useState, useEffect } from 'react'
import { formatDate, formatDateKey } from '../utils/dateUtils'
import EmojiReaction from './EmojiReaction'

const NEWS_CATEGORIES = {
  world_politics: { title: '世界政治新闻', color: 'bg-red-100 text-red-800' },
  world_economy: { title: '世界经济新闻', color: 'bg-blue-100 text-blue-800' },
  asia_politics: { title: '亚洲政治新闻', color: 'bg-yellow-100 text-yellow-800' },
  asia_economy: { title: '亚洲经济新闻', color: 'bg-green-100 text-green-800' },
  thailand_politics: { title: '中泰政治新闻', color: 'bg-purple-100 text-purple-800' },
  thailand_society: { title: '中泰民生新闻', color: 'bg-pink-100 text-pink-800' }
}

function NewsDisplay({ selectedDate, newsData, onEmojiUpdate }) {
  const hasNews = newsData && Object.keys(newsData).some(category => newsData[category]?.length > 0)

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        {formatDate(selectedDate)} 的新闻
      </h2>
      
      {!hasNews ? (
        <div className="text-center py-8 text-gray-500">
          <p>这一天暂无新闻记录</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(NEWS_CATEGORIES).map(([categoryKey, categoryInfo]) => {
            const categoryNews = newsData[categoryKey] || []
            
            if (categoryNews.length === 0) return null
            
            return (
              <div key={categoryKey} className="border-l-4 border-gray-200 pl-4">
                <div className="flex items-center mb-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${categoryInfo.color}`}>
                    {categoryInfo.title}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    ({categoryNews.length} 条)
                  </span>
                </div>
                
                <div className="space-y-3">
                  {categoryNews.map((item, index) => {
                    const newsId = `${formatDateKey(selectedDate)}-${categoryKey}-${index}`
                    
                    return (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <h3 className="font-medium text-gray-900 mb-2">
                          {item.link ? (
                            <a 
                              href={item.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {item.title}
                            </a>
                          ) : (
                            item.title
                          )}
                        </h3>
                        {item.summary && (
                          <p className="text-gray-600 text-sm leading-relaxed mb-3">
                            {item.summary}
                          </p>
                        )}
                        <EmojiReaction 
                          newsId={newsId} 
                          onUpdate={onEmojiUpdate}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default NewsDisplay