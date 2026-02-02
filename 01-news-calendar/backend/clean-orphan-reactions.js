import { getDatabase } from './database.js'
import fs from 'fs'
import path from 'path'

// Load news data to verify which newsIds are valid
function loadNewsData() {
  try {
    const newsFile = path.join(process.cwd(), '../public/news_202601.json')
    const data = JSON.parse(fs.readFileSync(newsFile, 'utf8'))
    return data
  } catch (error) {
    console.error('Failed to load news data:', error.message)
    return {}
  }
}

// Parse newsId to extract date, category, index
function parseNewsId(newsId) {
  try {
    // Handle new format: "2026-01-30-world_economy-0"
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
    
    // Handle old format: "2026年1月30日星期五-world_economy-0"
    const lastDashIndex = newsId.lastIndexOf('-')
    if (lastDashIndex === -1) return null
    
    const index = parseInt(newsId.substring(lastDashIndex + 1))
    const remaining = newsId.substring(0, lastDashIndex)
    
    const secondLastDashIndex = remaining.lastIndexOf('-')
    if (secondLastDashIndex === -1) return null
    
    const category = remaining.substring(secondLastDashIndex + 1)
    const dateStr = remaining.substring(0, secondLastDashIndex)
    
    // Convert Chinese date to standard format
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

// Check if a newsId exists in the news data
function isValidNewsId(newsId, newsData) {
  const parsed = parseNewsId(newsId)
  if (!parsed) return false
  
  const { date, category, index } = parsed
  const dayNews = newsData[date]
  
  if (!dayNews || !dayNews[category] || !dayNews[category][index]) {
    return false
  }
  
  return true
}

async function cleanOrphanReactions() {
  const db = getDatabase()
  const newsData = loadNewsData()
  
  console.log('=== Cleaning Orphan Emoji Reactions ===')
  console.log('Loaded news data for', Object.keys(newsData).length, 'dates')
  
  // Get all unique newsIds from emoji_reactions
  const query = 'SELECT DISTINCT news_id FROM emoji_reactions ORDER BY news_id'
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Query failed:', err.message)
      return
    }
    
    console.log(`\nFound ${rows.length} unique newsIds in database:`)
    
    const orphanIds = []
    const validIds = []
    
    rows.forEach((row, index) => {
      const newsId = row.news_id
      console.log(`\n${index + 1}. Checking: ${newsId}`)
      
      if (isValidNewsId(newsId, newsData)) {
        console.log('   ✅ Valid - news exists')
        validIds.push(newsId)
      } else {
        console.log('   ❌ Orphan - news not found')
        orphanIds.push(newsId)
      }
    })
    
    console.log(`\n=== Summary ===`)
    console.log(`Valid newsIds: ${validIds.length}`)
    console.log(`Orphan newsIds: ${orphanIds.length}`)
    
    if (orphanIds.length === 0) {
      console.log('No orphan reactions to clean!')
      process.exit(0)
      return
    }
    
    console.log(`\nOrphan newsIds to be deleted:`)
    orphanIds.forEach((id, index) => {
      console.log(`${index + 1}. ${id}`)
    })
    
    // Delete orphan reactions
    console.log(`\n=== Deleting Orphan Reactions ===`)
    let deletedCount = 0
    let processedCount = 0
    
    orphanIds.forEach((newsId) => {
      const deleteQuery = 'DELETE FROM emoji_reactions WHERE news_id = ?'
      db.run(deleteQuery, [newsId], function(deleteErr) {
        processedCount++
        
        if (deleteErr) {
          console.error(`Failed to delete reactions for ${newsId}:`, deleteErr.message)
        } else {
          deletedCount += this.changes
          console.log(`✅ Deleted ${this.changes} reactions for ${newsId}`)
        }
        
        // Check if all deletions are complete
        if (processedCount === orphanIds.length) {
          console.log(`\n=== Cleanup Complete ===`)
          console.log(`Deleted ${deletedCount} orphan reactions`)
          console.log(`Remaining valid reactions: ${validIds.length} newsIds`)
          
          // Show final hot news ranking
          const hotQuery = `
            SELECT 
              news_id,
              COUNT(*) as total_reactions,
              MIN(created_at) as first_reaction_time
            FROM emoji_reactions
            GROUP BY news_id
            ORDER BY total_reactions DESC, first_reaction_time ASC
            LIMIT 5
          `
          
          db.all(hotQuery, [], (err, hotRows) => {
            if (err) {
              console.error('Query final hot news failed:', err.message)
            } else {
              console.log(`\n=== Final Hot News Ranking ===`)
              console.log(`Hot news count: ${hotRows.length}`)
              hotRows.forEach((row, index) => {
                console.log(`${index + 1}. ${row.news_id} (${row.total_reactions} reactions)`)
              })
            }
            process.exit(0)
          })
        }
      })
    })
  })
}

// Run cleanup
cleanOrphanReactions()