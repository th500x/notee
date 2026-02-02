import express from 'express'
import { getDatabase } from '../database.js'

const router = express.Router()

// Hot news ranking API
router.get('/hot/ranking', (req, res) => {
  const db = getDatabase()
  
  const query = `
    SELECT 
      news_id,
      COUNT(*) as total_reactions,
      MIN(created_at) as first_reaction_time
    FROM emoji_reactions
    GROUP BY news_id
    ORDER BY total_reactions DESC, first_reaction_time ASC
    LIMIT 3
  `
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Get hot news failed:', err.message)
      return res.status(500).json({
        success: false,
        error: 'Get hot news failed'
      })
    }
    
    if (rows.length === 0) {
      return res.json({
        success: true,
        data: []
      })
    }
    
    // Get detailed emoji breakdown for each news
    let processedCount = 0
    const hotNewsWithEmojis = []
    
    rows.forEach((row) => {
      // Get emoji breakdown for this news
      const emojiQuery = `
        SELECT emoji, COUNT(*) as count
        FROM emoji_reactions
        WHERE news_id = ?
        GROUP BY emoji
        ORDER BY count DESC
      `
      
      db.all(emojiQuery, [row.news_id], (emojiErr, emojiRows) => {
        processedCount++
        
        if (emojiErr) {
          console.error(`Get emoji breakdown failed for ${row.news_id}:`, emojiErr.message)
          hotNewsWithEmojis.push({
            ...row,
            emoji_breakdown: {},
            top_emoji: '🍺'
          })
        } else {
          const emojiBreakdown = {}
          let topEmoji = '🍺'
          let maxCount = 0
          
          emojiRows.forEach(emojiRow => {
            emojiBreakdown[emojiRow.emoji] = emojiRow.count
            if (emojiRow.count > maxCount) {
              maxCount = emojiRow.count
              topEmoji = emojiRow.emoji
            }
          })
          
          hotNewsWithEmojis.push({
            ...row,
            emoji_breakdown: emojiBreakdown,
            top_emoji: topEmoji
          })
        }
        
        // Check if all news processed
        if (processedCount === rows.length) {
          // Sort by total_reactions DESC, first_reaction_time ASC
          hotNewsWithEmojis.sort((a, b) => {
            if (b.total_reactions !== a.total_reactions) {
              return b.total_reactions - a.total_reactions
            }
            return new Date(a.first_reaction_time) - new Date(b.first_reaction_time)
          })
          
          res.json({
            success: true,
            data: hotNewsWithEmojis
          })
        }
      })
    })
  })
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
router.get('/:newsId', (req, res) => {
  const { newsId } = req.params
  const db = getDatabase()
  
  const query = `
    SELECT emoji, COUNT(*) as count
    FROM emoji_reactions
    WHERE news_id = ?
    GROUP BY emoji
  `
  
  db.all(query, [newsId], (err, rows) => {
    if (err) {
      console.error('Get emoji reactions failed:', err.message)
      return res.status(500).json({
        success: false,
        error: 'Get emoji reactions failed'
      })
    }
    
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
  })
})

// 获取用户对特定新闻的反应
router.get('/:newsId/user', (req, res) => {
  const { newsId } = req.params
  const clientIP = req.clientIP
  const db = getDatabase()
  
  const query = `
    SELECT emoji
    FROM emoji_reactions
    WHERE news_id = ? AND ip_address = ?
  `
  
  db.get(query, [newsId, clientIP], (err, row) => {
    if (err) {
      console.error('获取用户反应失败:', err.message)
      return res.status(500).json({
        success: false,
        error: '获取用户反应失败'
      })
    }
    
    res.json({
      success: true,
      data: {
        emoji: row ? row.emoji : null
      }
    })
  })
})

// Add or update emoji reaction
router.post('/', (req, res) => {
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
  
  // Check if user already has a reaction for this news
  const checkQuery = `
    SELECT emoji FROM emoji_reactions 
    WHERE news_id = ? AND ip_address = ?
  `
  
  db.get(checkQuery, [newsId, clientIP], (err, existingRow) => {
    if (err) {
      console.error('Check existing reaction failed:', err.message)
      return res.status(500).json({
        success: false,
        error: 'Check existing reaction failed'
      })
    }
    
    // Use REPLACE INTO to insert or update (SQLite specific syntax)
    const query = `
      REPLACE INTO emoji_reactions (news_id, emoji, ip_address)
      VALUES (?, ?, ?)
    `
    
    db.run(query, [newsId, emoji, clientIP], function(err) {
      if (err) {
        console.error('Add emoji reaction failed:', err.message)
        return res.status(500).json({
          success: false,
          error: 'Add emoji reaction failed'
        })
      }
      
      res.json({
        success: true,
        message: 'Emoji reaction added successfully'
      })
    })
  })
})

// Delete emoji reaction
router.delete('/:newsId', (req, res) => {
  const { newsId } = req.params
  const clientIP = req.clientIP
  const db = getDatabase()
  
  const query = `
    DELETE FROM emoji_reactions
    WHERE news_id = ? AND ip_address = ?
  `
  
  db.run(query, [newsId, clientIP], function(err) {
    if (err) {
      console.error('Delete emoji reaction failed:', err.message)
      return res.status(500).json({
        success: false,
        error: 'Delete emoji reaction failed'
      })
    }
    
    if (this.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'No reaction found to delete'
      })
    }
    
    res.json({
      success: true,
      message: 'Emoji reaction deleted successfully'
    })
  })
})

export default router