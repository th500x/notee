import { useState, useEffect } from 'react'
import { emojiAPI } from '../services/api'
import { EMOJI_CONSTANTS } from '../constants'

const EMOJIS = [
  { emoji: EMOJI_CONSTANTS.BEER, label: '精彩' },
  { emoji: EMOJI_CONSTANTS.THUMBS_UP, label: '赞' },
  { emoji: EMOJI_CONSTANTS.THUMBS_DOWN, label: '踩' }
]

function EmojiReaction({ newsId, onUpdate }) {
  const [reactions, setReactions] = useState({ '🍺': 0, '👍': 0, '👎': 0 })
  const [userReaction, setUserReaction] = useState(null)
  const [loading, setLoading] = useState(false)

  // 加载数据的函数（提取出来供多处使用）
  const loadData = async () => {
    if (!newsId) return
    
    try {
      const [reactionsRes, userRes] = await Promise.all([
        emojiAPI.getReactions(newsId),
        emojiAPI.getUserReaction(newsId)
      ])
      
      if (reactionsRes.success) {
        setReactions(reactionsRes.data)
      }
      
      if (userRes.success) {
        setUserReaction(userRes.data.emoji)
      }
    } catch (error) {
      console.error('加载emoji反应失败:', error)
      setReactions({ '🍺': 0, '👍': 0, '👎': 0 })
      setUserReaction(null)
    }
  }

  // 当newsId改变时，重新加载数据
  useEffect(() => {
    if (!newsId) return
    
    let cancelled = false
    
    // 重置状态，避免显示上一个新闻的数据
    setReactions({ '🍺': 0, '👍': 0, '👎': 0 })
    setUserReaction(null)
    
    // 并行加载数据，提升性能
    const loadDataWithCancel = async () => {
      try {
        const [reactionsRes, userRes] = await Promise.all([
          emojiAPI.getReactions(newsId),
          emojiAPI.getUserReaction(newsId)
        ])
        
        // 检查是否已取消（防止竞态条件）
        if (cancelled) return
        
        if (reactionsRes.success) {
          setReactions(reactionsRes.data)
        }
        
        if (userRes.success) {
          setUserReaction(userRes.data.emoji)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('加载emoji反应失败:', error)
          setReactions({ '🍺': 0, '👍': 0, '👎': 0 })
          setUserReaction(null)
        }
      }
    }
    
    loadDataWithCancel()
    
    // Cleanup函数：组件卸载或newsId变化时取消请求
    return () => {
      cancelled = true
    }
  }, [newsId])

  const handleEmojiClick = async (emoji) => {
    if (loading || !newsId) return

    setLoading(true)
    
    try {
      if (userReaction === emoji) {
        // Cancel selection if clicking the same emoji
        const response = await emojiAPI.deleteReaction(newsId)
        
        if (response.success) {
          setUserReaction(null)
          await loadData()
          if (onUpdate) {
            setTimeout(() => {
              onUpdate()
            }, EMOJI_CONSTANTS.UPDATE_DELAY)
          }
        }
      } else {
        // Select new emoji
        const response = await emojiAPI.addReaction(newsId, emoji)
        
        if (response.success) {
          setUserReaction(emoji)
          await loadData()
          if (onUpdate) {
            setTimeout(() => {
              onUpdate()
            }, EMOJI_CONSTANTS.UPDATE_DELAY)
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