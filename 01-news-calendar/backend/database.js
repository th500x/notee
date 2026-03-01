import sqlite3 from 'sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, 'news_calendar.db')
let db = null

/**
 * 获取数据库实例（单例模式）
 * @returns {sqlite3.Database} 数据库实例
 * @throws {Error} 如果数据库未初始化或连接失败
 */
export function getDatabase() {
  if (!db) {
    try {
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('数据库连接失败:', err.message)
          db = null
          throw new Error(`数据库连接失败: ${err.message}`)
        } else {
          console.log('数据库连接成功')
        }
      })
    } catch (error) {
      console.error('创建数据库实例失败:', error)
      throw error
    }
  }
  
  if (!db) {
    throw new Error('数据库未初始化')
  }
  
  return db
}

/**
 * 将数据库回调转换为Promise
 * @param {sqlite3.Database} db - 数据库实例
 * @param {string} query - SQL查询
 * @param {Array} params - 查询参数
 * @returns {Promise<Array>} 查询结果
 */
export function dbAll(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('[DB] 查询失败:', err.message)
        reject(err)
      } else {
        resolve(rows)
      }
    })
  })
}

/**
 * 将数据库回调转换为Promise（单行）
 * @param {sqlite3.Database} db - 数据库实例
 * @param {string} query - SQL查询
 * @param {Array} params - 查询参数
 * @returns {Promise<Object|undefined>} 查询结果
 */
export function dbGet(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        console.error('[DB] 查询失败:', err.message)
        reject(err)
      } else {
        resolve(row)
      }
    })
  })
}

/**
 * 将数据库回调转换为Promise（执行）
 * @param {sqlite3.Database} db - 数据库实例
 * @param {string} query - SQL查询
 * @param {Array} params - 查询参数
 * @returns {Promise<Object>} 执行结果（包含lastID和changes）
 */
export function dbRun(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        console.error('[DB] 执行失败:', err.message)
        reject(err)
      } else {
        resolve({
          lastID: this.lastID,
          changes: this.changes
        })
      }
    })
  })
}

/**
 * 执行事务
 * @param {sqlite3.Database} db - 数据库实例
 * @param {Function} callback - 事务回调函数，接收db参数
 * @returns {Promise<any>} 事务结果
 */
export async function runTransaction(db, callback) {
  try {
    // 开始事务
    await dbRun(db, 'BEGIN TRANSACTION')
    
    // 执行事务操作
    const result = await callback(db)
    
    // 提交事务
    await dbRun(db, 'COMMIT')
    
    return result
  } catch (error) {
    // 回滚事务
    try {
      await dbRun(db, 'ROLLBACK')
      console.log('[DB] 事务已回滚')
    } catch (rollbackError) {
      console.error('[DB] 回滚失败:', rollbackError.message)
    }
    
    throw error
  }
}

export async function initDatabase() {
  return new Promise((resolve, reject) => {
    let database
    
    try {
      database = getDatabase()
    } catch (error) {
      reject(error)
      return
    }
    
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
        db = null
      }
    })
  }
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭数据库连接...')
  closeDatabase()
  setTimeout(() => {
    process.exit(0)
  }, 1000)
})

process.on('SIGTERM', () => {
  console.log('\n收到SIGTERM信号，正在关闭数据库连接...')
  closeDatabase()
  setTimeout(() => {
    process.exit(0)
  }, 1000)
})