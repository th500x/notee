import { useState, useEffect } from 'react'
import { emojiAPI } from '../services/api'

const EMOJIS = [
  { emoji: '🍺', label: '精彩' },
  { emoji: '👍', label: '赞' },
  { emoji: '👎', label: '踩' }
]

function EmojiReaction({ newsId, onUpdate }) {
  const [reactions, setReactions] = useState({ '🍺': 0, '👍': 0, '👎': 0 })
  const [userReaction, setUserReaction] = useState(null)
  const [loading, setLoading] = useState(false)

  // 当newsId改变时，重新加载数据
  useEffect(() => {
    if (newsId) {
      // 重置状态，避免显示上一个新闻的数据
      setReactions({ '🍺': 0, '👍': 0, '👎': 0 })
      setUserReaction(null)
      
      // 加载新的数据
      loadReactions()
      loadUserReaction()
    }
  }, [newsId])

  const loadReactions = async () => {
    if (!newsId) return
    
    try {
      const response = await emojiAPI.getReactions(newsId)
      if (response.success) {
        setReactions(response.data)
      }
    } catch (error) {
      console.error('加载emoji反应失败:', error)
      setReactions({ '🍺': 0, '👍': 0, '👎': 0 })
    }
  }

  const loadUserReaction = async () => {
    if (!newsId) return
    
    try {
      const response = await emojiAPI.getUserReaction(newsId)
      if (response.success) {
        setUserReaction(response.data.emoji)
      }
    } catch (error) {
      console.error('加载用户反应失败:', error)
      setUserReaction(null)
    }
  }

  const handleEmojiClick = async (emoji) => {
    if (loading || !newsId) return

    setLoading(true)
    
    try {
      if (userReaction === emoji) {
        // Cancel selection if clicking the same emoji
        const response = await emojiAPI.deleteReaction(newsId)
        
        if (response.success) {
          setUserReaction(null)
          await loadReactions()
          if (onUpdate) {
            setTimeout(() => {
              onUpdate()
            }, 300)
          }
        }
      } else {
        // Select new emoji
        const response = await emojiAPI.addReaction(newsId, emoji)
        
        if (response.success) {
          setUserReaction(emoji)
          await loadReactions()
          if (onUpdate) {
            setTimeout(() => {
              onUpdate()
            }, 300)
          }
        }
      }
    } catch (error) {
      console.error('Emoji reaction operation failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // 如果没有newsId，不渲染组件
  if (!newsId) {
    return null
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-600">Your feeling:</span>
        <div className="flex space-x-1">
          {EMOJIS.map(({ emoji, label }) => (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              disabled={loading}
              className={`
                flex items-center space-x-1 px-2 py-1 rounded-full text-sm transition-all
                ${userReaction === emoji 
                  ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-300' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
                ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={label}
            >
              <span className="text-base">{emoji}</span>
              <span className="font-medium">{reactions[emoji] || 0}</span>
            </button>
          ))}
        </div>
      </div>
      
      {userReaction && (
        <div className="mt-2 text-xs text-gray-500">
          You selected {userReaction}, click to cancel
        </div>
      )}
    </div>
  )
}

export default EmojiReaction