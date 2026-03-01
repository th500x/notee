import express from 'express'
import { getDatabase } from '../database.js'

const router = express.Router()

// 日志脱敏函数
function sanitizeLog(data) {
  if (!data || typeof data !== 'object') return data
  
  const sanitized = { ...data }
  
  // 脱敏IP地址（只显示前两段）
  if (sanitized.ip && typeof sanitized.ip === 'string') {
    const parts = sanitized.ip.split('.')
    if (parts.length === 4) {
      sanitized.ip = `${parts[0]}.${parts[1]}.***.***.***`
    }
  }
  
  return sanitized
}

// 输入验证中间件
function validateNewsId(req, res, next) {
  const newsId = req.params.newsId || req.body.newsId
  
  if (!newsId) {
    return res.status(400).json({
      success: false,
      error: '新闻ID不能为空'
    })
  }
  
  // 验证newsId格式（防止SQL注入和路径遍历）
  if (typeof newsId !== 'string' || newsId.length > 200) {
    return res.status(400).json({
      success: false,
      error: '无效的新闻ID格式'
    })
  }
  
  // 防止路径遍历攻击
  if (newsId.includes('..') || newsId.includes('/') || newsId.includes('\\')) {
    console.warn('[Security] 检测到路径遍历攻击尝试:', sanitizeLog({ 
      newsId, 
      ip: req.clientIP 
    }))
    return res.status(400).json({
      success: false,
      error: '无效的新闻ID格式'
    })
  }
  
  next()
}

// 验证emoji
function validateEmoji(req, res, next) {
  const { emoji } = req.body
  
  if (!emoji) {
    return res.status(400).json({
      success: false,
      error: 'Emoji不能为空'
    })
  }
  
  const validEmojis = ['🍺', '👍', '👎']
  if (!validEmojis.includes(emoji)) {
    console.warn('[Security] 无效的emoji尝试:', sanitizeLog({ 
      emoji, 
      ip: req.clientIP 
    }))
    return res.status(400).json({
      success: false,
      error: '无效的emoji'
    })
  }
  
  next()
}

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
    console.error('[Emoji] 获取热门新闻失败:', sanitizeLog({ 
      error: error.message,
      ip: req.clientIP 
    }))
    
    const errorMessage = process.env.NODE_ENV === 'production'
      ? '获取热门新闻失败，请稍后重试'
      : `获取热门新闻失败: ${error.message}`
    
    res.status(500).json({
      success: false,
      error: errorMessage
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
router.get('/:newsId', validateNewsId, async (req, res) => {
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
    console.error('[Emoji] 获取emoji反应失败:', sanitizeLog({ 
      error: error.message,
      newsId,
      ip: req.clientIP 
    }))
    
    const errorMessage = process.env.NODE_ENV === 'production'
      ? '获取emoji反应失败，请稍后重试'
      : `获取emoji反应失败: ${error.message}`
    
    res.status(500).json({
      success: false,
      error: errorMessage
    })
  }
})

// 获取用户对特定新闻的反应
router.get('/:newsId/user', validateNewsId, async (req, res) => {
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
    console.error('[Emoji] 获取用户反应失败:', sanitizeLog({ 
      error: error.message,
      newsId,
      ip: req.clientIP 
    }))
    
    const errorMessage = process.env.NODE_ENV === 'production'
      ? '获取用户反应失败，请稍后重试'
      : `获取用户反应失败: ${error.message}`
    
    res.status(500).json({
      success: false,
      error: errorMessage
    })
  }
})

// Add or update emoji reaction
router.post('/', validateNewsId, validateEmoji, async (req, res) => {
  const { newsId, emoji } = req.body
  const clientIP = req.clientIP
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
      message: 'Emoji反应添加成功'
    })
  } catch (error) {
    console.error('[Emoji] 添加emoji反应失败:', sanitizeLog({ 
      error: error.message,
      newsId,
      emoji,
      ip: req.clientIP 
    }))
    
    const errorMessage = process.env.NODE_ENV === 'production'
      ? '添加emoji反应失败，请稍后重试'
      : `添加emoji反应失败: ${error.message}`
    
    res.status(500).json({
      success: false,
      error: errorMessage
    })
  }
})

// Delete emoji reaction
router.delete('/:newsId', validateNewsId, async (req, res) => {
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
        error: '未找到要删除的反应'
      })
    }
    
    res.json({
      success: true,
      message: 'Emoji反应删除成功'
    })
  } catch (error) {
    console.error('[Emoji] 删除emoji反应失败:', sanitizeLog({ 
      error: error.message,
      newsId,
      ip: req.clientIP 
    }))
    
    const errorMessage = process.env.NODE_ENV === 'production'
      ? '删除emoji反应失败，请稍后重试'
      : `删除emoji反应失败: ${error.message}`
    
    res.status(500).json({
      success: false,
      error: errorMessage
    })
  }
})

export default router