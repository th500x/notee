import express from 'express'
import { getDatabase } from '../database.js'

const router = express.Router()

/**
 * 将数据库回调转换为Promise
 * @param {Object} db - 数据库实例
 * @param {string} query - SQL查询
 * @param {Array} params - 查询参数
 * @returns {Promise<Array>} 查询结果
 */
function dbAll(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

/**
 * 将数据库回调转换为Promise（单行）
 * @param {Object} db - 数据库实例
 * @param {string} query - SQL查询
 * @param {Array} params - 查询参数
 * @returns {Promise<Object>} 查询结果
 */
function dbGet(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

/**
 * 将数据库回调转换为Promise（执行）
 * @param {Object} db - 数据库实例
 * @param {string} query - SQL查询
 * @param {Array} params - 查询参数
 * @returns {Promise<Object>} 执行结果
 */
function dbRun(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err)
      else resolve(this)
    })
  })
}

// Hot news ranking API - 优化版本（单次查询）
router.get('/hot/ranking', async (req, res) => {
  const db = getDatabase()
  
  try {
    // 单次查询获取所有数据（包括emoji分布）
    const query = `
      SELECT 
        news_id,
        emoji,
        COUNT(*) as count,
        MIN(created_at) as first_reaction_time
      FROM emoji_reactions
      GROUP BY news_id, emoji
    `
    
    const rows = await dbAll(db, query)
    
    if (rows.length === 0) {
      return res.json({
        success: true,
        data: []
      })
    }
    
    // 在内存中聚合数据
    const newsMap = new Map()
    
    rows.forEach(row => {
      if (!newsMap.has(row.news_id)) {
        newsMap.set(row.news_id, {
          news_id: row.news_id,
          total_reactions: 0,
          emoji_breakdown: {},
          first_reaction_time: row.first_reaction_time
        })
      }
      
      const news = newsMap.get(row.news_id)
      news.total_reactions += row.count
      news.emoji_breakdown[row.emoji] = row.count
      
      // 更新最早反应时间
      if (row.first_reaction_time < news.first_reaction_time) {
        news.first_reaction_time = row.first_reaction_time
      }
    })
    
    // 排序并取前3
    const hotNews = Array.from(newsMap.values())
      .sort((a, b) => {
        // 按反应数降序
        if (b.total_reactions !== a.total_reactions) {
          return b.total_reactions - a.total_reactions
        }
        // 反应数相同时，按最早反应时间升序
        return new Date(a.first_reaction_time) - new Date(b.first_reaction_time)
      })
      .slice(0, 3)
      .map(news => {
        // 找出最多的emoji
        const topEmoji = Object.entries(news.emoji_breakdown)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || '🍺'
        
        return {
          ...news,
          top_emoji: topEmoji
        }
      })
    
    res.json({
      success: true,
      data: hotNews
    })
  } catch (error) {
    console.error('[Emoji] 获取热门新闻失败:', error)
    res.status(500).json({
      success: false,
      error: '获取热门新闻失败'
    })
  }
})

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Hot news API route working',
    timestamp: new Date().toISOString()
  })
})

// Get emoji reactions for a news item
router.get('/:newsId', async (req, res) => {
  const { newsId } = req.params
  const db = getDatabase()
  
  try {
    const query = `
      SELECT emoji, COUNT(*) as count
      FROM emoji_reactions
      WHERE news_id = ?
      GROUP BY emoji
    `
    
    const rows = await dbAll(db, query, [newsId])
    
    // Initialize all emoji counts
    const reactions = {
      '🍺': 0,
      '👍': 0,
      '👎': 0
    }
    
    // Fill in actual data
    rows.forEach(row => {
      if (reactions.hasOwnProperty(row.emoji)) {
        reactions[row.emoji] = row.count
      }
    })
    
    res.json({
      success: true,
      data: reactions
    })
  } catch (error) {
    console.error('[Emoji] 获取emoji反应失败:', error)
    res.status(500).json({
      success: false,
      error: '获取emoji反应失败'
    })
  }
})

// 获取用户对特定新闻的反应
router.get('/:newsId/user', async (req, res) => {
  const { newsId } = req.params
  const clientIP = req.clientIP
  const db = getDatabase()
  
  try {
    const query = `
      SELECT emoji
      FROM emoji_reactions
      WHERE news_id = ? AND ip_address = ?
    `
    
    const row = await dbGet(db, query, [newsId, clientIP])
    
    res.json({
      success: true,
      data: {
        emoji: row ? row.emoji : null
      }
    })
  } catch (error) {
    console.error('[Emoji] 获取用户反应失败:', error)
    res.status(500).json({
      success: false,
      error: '获取用户反应失败'
    })
  }
})

// Add or update emoji reaction
router.post('/', async (req, res) => {
  const { newsId, emoji } = req.body
  const clientIP = req.clientIP
  
  // Validate input
  if (!newsId || !emoji) {
    return res.status(400).json({
      success: false,
      error: 'News ID and emoji cannot be empty'
    })
  }
  
  // Validate emoji
  const validEmojis = ['🍺', '👍', '👎']
  if (!validEmojis.includes(emoji)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid emoji'
    })
  }
  
  const db = getDatabase()
  
  try {
    // Use REPLACE INTO to insert or update (SQLite specific syntax)
    const query = `
      REPLACE INTO emoji_reactions (news_id, emoji, ip_address)
      VALUES (?, ?, ?)
    `
    
    await dbRun(db, query, [newsId, emoji, clientIP])
    
    res.json({
      success: true,
      message: 'Emoji reaction added successfully'
    })
  } catch (error) {
    console.error('[Emoji] 添加emoji反应失败:', error)
    res.status(500).json({
      success: false,
      error: '添加emoji反应失败'
    })
  }
})

// Delete emoji reaction
router.delete('/:newsId', async (req, res) => {
  const { newsId } = req.params
  const clientIP = req.clientIP
  const db = getDatabase()
  
  try {
    const query = `
      DELETE FROM emoji_reactions
      WHERE news_id = ? AND ip_address = ?
    `
    
    const result = await dbRun(db, query, [newsId, clientIP])
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'No reaction found to delete'
      })
    }
    
    res.json({
      success: true,
      message: 'Emoji reaction deleted successfully'
    })
  } catch (error) {
    console.error('[Emoji] 删除emoji反应失败:', error)
    res.status(500).json({
      success: false,
      error: '删除emoji反应失败'
    })
  }
})

export default router