import sqlite3 from 'sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, 'news_calendar.db')
let db = null

export function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message)
      } else {
        console.log('数据库连接成功')
      }
    })
  }
  return db
}

export async function initDatabase() {
  return new Promise((resolve, reject) => {
    const database = getDatabase()
    
    // 只创建emoji反应表
    const createEmojiReactionsTable = `
      CREATE TABLE IF NOT EXISTS emoji_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        news_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(news_id, ip_address)
      )
    `
    
    // 创建新闻表（可选，用于存储新闻数据）
    const createNewsTable = `
      CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        link TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
    
    database.serialize(() => {
      // 创建新闻表
      database.run(createNewsTable, (err) => {
        if (err) {
          console.error('创建新闻表失败:', err.message)
          reject(err)
          return
        }
        console.log('✅ 新闻表创建成功')
      })
      
      // 创建emoji反应表
      database.run(createEmojiReactionsTable, (err) => {
        if (err) {
          console.error('创建emoji反应表失败:', err.message)
          reject(err)
          return
        }
        console.log('✅ emoji反应表创建成功')
      })
      
      // 添加索引优化查询性能
      database.run(`
        CREATE INDEX IF NOT EXISTS idx_emoji_reactions_news_id 
        ON emoji_reactions(news_id)
      `, (err) => {
        if (err) {
          console.error('创建news_id索引失败:', err.message)
        } else {
          console.log('✅ news_id索引创建成功')
        }
      })
      
      database.run(`
        CREATE INDEX IF NOT EXISTS idx_emoji_reactions_created_at 
        ON emoji_reactions(created_at)
      `, (err) => {
        if (err) {
          console.error('创建created_at索引失败:', err.message)
        } else {
          console.log('✅ created_at索引创建成功')
        }
      })
      
      // 创建复合索引用于热门新闻查询
      database.run(`
        CREATE INDEX IF NOT EXISTS idx_emoji_reactions_composite 
        ON emoji_reactions(news_id, emoji, created_at)
      `, (err) => {
        if (err) {
          console.error('创建复合索引失败:', err.message)
          reject(err)
        } else {
          console.log('✅ 复合索引创建成功')
          resolve()
        }
      })
    })
  })
}

// 关闭数据库连接
export function closeDatabase() {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('关闭数据库失败:', err.message)
      } else {
        console.log('数据库连接已关闭')
      }
    })
  }
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭数据库连接...')
  closeDatabase()
  process.exit(0)
})