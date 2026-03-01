/**
 * 书籍数据服务
 * 统一管理书籍数据的加载和访问
 */

import { LOG_PREFIX } from '../constants'

// 书籍元数据缓存
let booksMetadataCache = null

// 书籍内容缓存
const booksContentCache = new Map()

/**
 * 动态加载书籍数据
 * @param {string} bookId - 书籍ID
 * @returns {Promise<Object>} 书籍数据
 */
export async function loadBookData(bookId) {
  try {
    // 检查缓存
    if (booksContentCache.has(bookId)) {
      console.log(`${LOG_PREFIX.BOOK_CONTEXT} 使用缓存的书籍数据:`, bookId)
      return booksContentCache.get(bookId)
    }
    
    console.log(`${LOG_PREFIX.BOOK_CONTEXT} 动态加载书籍:`, bookId)
    
    // 动态导入书籍数据
    const module = await import(`../data/books/${bookId}.jsx`)
    const bookKey = `book_${bookId.replace(/-/g, '_')}`
    
    if (!module[bookKey]) {
      throw new Error(`书籍数据未找到: ${bookId}`)
    }
    
    const bookData = module[bookKey]
    
    // 缓存书籍数据
    booksContentCache.set(bookId, bookData)
    
    return bookData
  } catch (error) {
    console.error(`${LOG_PREFIX.BOOK_CONTEXT} 加载书籍失败:`, bookId, error)
    throw new Error(`无法加载书籍: ${bookId}`)
  }
}

/**
 * 获取所有书籍的元数据（不加载完整内容）
 * @returns {Array<Object>} 书籍元数据列表
 */
export function getAllBooksMetadata() {
  // 使用缓存
  if (booksMetadataCache) {
    return booksMetadataCache
  }
  
  booksMetadataCache = [
    {
      id: '02-01-san-nanyang',
      title: '三棋南阳史记',
      description: '记录三棋南阳的游戏历程',
      category: '游戏史记',
      theme: 'classic',
      requirePassword: false,
      loader: () => import('../data/books/book-02-01-san-nanyang')
    },
    {
      id: '02-02-diary-chao',
      title: '潮汕日记',
      description: '潮汕之行的点滴记录',
      category: '游记杂谈',
      theme: 'modern',
      requirePassword: false,
      loader: () => import('../data/books/book-02-02-diary-chao')
    },
    {
      id: '02-03-review-map',
      title: '地图回顾',
      description: '游戏地图的回顾与分析',
      category: '游戏史记',
      theme: 'vintage',
      requirePassword: false,
      loader: () => import('../data/books/book-02-03-review-map')
    },
    {
      id: '02-04-review-game',
      title: '游戏回顾',
      description: '经典游戏的回顾与思考',
      category: '游戏史记',
      theme: 'elegant',
      requirePassword: false,
      loader: () => import('../data/books/book-02-04-review-game')
    },
    {
      id: '02-11-story-thailand',
      title: '泰国故事',
      description: '泰国之旅的故事集',
      category: '游记杂谈',
      theme: 'tropical',
      requirePassword: false,
      loader: () => import('../data/books/book-02-11-story-thailand')
    }
  ]
  
  return booksMetadataCache
}

/**
 * 验证书籍ID是否有效
 * @param {string} bookId - 书籍ID
 * @returns {boolean}
 */
export function isValidBookId(bookId) {
  if (!bookId || typeof bookId !== 'string') {
    return false
  }
  
  const metadata = getAllBooksMetadata()
  return metadata.some(book => book.id === bookId)
}

/**
 * 预加载书籍数据
 * @param {string} bookId - 书籍ID
 * @returns {Promise<void>}
 */
export async function preloadBookData(bookId) {
  if (!booksContentCache.has(bookId)) {
    try {
      await loadBookData(bookId)
      console.log(`${LOG_PREFIX.BOOK_CONTEXT} 预加载完成:`, bookId)
    } catch (error) {
      console.warn(`${LOG_PREFIX.BOOK_CONTEXT} 预加载失败:`, bookId, error)
    }
  }
}

/**
 * 清除书籍缓存
 * @param {string} bookId - 书籍ID（可选，不传则清除所有）
 */
export function clearBookCache(bookId) {
  if (bookId) {
    booksContentCache.delete(bookId)
    console.log(`${LOG_PREFIX.BOOK_CONTEXT} 清除缓存:`, bookId)
  } else {
    booksContentCache.clear()
    console.log(`${LOG_PREFIX.BOOK_CONTEXT} 清除所有缓存`)
  }
}

/**
 * 获取缓存信息
 * @returns {Object} 缓存统计
 */
export function getCacheInfo() {
  return {
    cachedBooks: Array.from(booksContentCache.keys()),
    cacheSize: booksContentCache.size
  }
}
