/**
 * 书籍数据服务
 * 统一管理书籍数据的加载、缓存和访问
 * 
 * @module services/bookService
 * @description
 * 该服务提供书籍数据的动态加载和缓存管理功能：
 * - 按需加载书籍内容（减少初始加载时间）
 * - 智能缓存机制（避免重复加载）
 * - 元数据管理（快速获取书籍列表）
 * - 预加载支持（提升用户体验）
 * 
 * @example
 * import * as bookService from './services/bookService'
 * 
 * // 获取所有书籍元数据
 * const books = bookService.getAllBooksMetadata()
 * 
 * // 动态加载书籍内容
 * const book = await bookService.loadBookData('02-01-san-nanyang')
 * 
 * // 预加载书籍
 * await bookService.preloadBookData('02-02-diary-chao')
 */

import { LOG_PREFIX } from '../constants'

// 书籍元数据缓存
let booksMetadataCache = null

// 书籍内容缓存
const booksContentCache = new Map()

/**
 * 动态加载书籍数据
 * 
 * @async
 * @param {string} bookId - 书籍ID（格式：02-01-san-nanyang）
 * @returns {Promise<Object>} 书籍数据对象
 * @returns {string} return.id - 书籍ID
 * @returns {string} return.title - 书籍标题
 * @returns {string} return.description - 书籍描述
 * @returns {Array<Object>} return.chapters - 章节列表
 * @returns {Object} return.images - 图片映射
 * 
 * @description
 * 动态导入书籍数据文件。首次加载时从文件导入，
 * 后续访问直接从缓存读取。
 * 
 * @throws {Error} 当书籍ID不存在或加载失败时
 * 
 * @example
 * try {
 *   const book = await loadBookData('02-01-san-nanyang')
 *   console.log(`加载书籍: ${book.title}`)
 *   console.log(`章节数: ${book.chapters.length}`)
 * } catch (error) {
 *   console.error('加载失败:', error.message)
 * }
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
 * 获取所有书籍的元数据
 * 
 * @returns {Array<Object>} 书籍元数据列表
 * @returns {string} return[].id - 书籍ID
 * @returns {string} return[].title - 书籍标题
 * @returns {string} return[].description - 书籍描述
 * @returns {string} return[].category - 书籍分类
 * @returns {string} return[].theme - 主题样式
 * @returns {boolean} return[].requirePassword - 是否需要密码
 * @returns {Function} return[].loader - 动态加载函数
 * 
 * @description
 * 获取所有书籍的基本信息，不加载完整内容。
 * 结果会被缓存，多次调用不会重复计算。
 * 
 * @example
 * const books = getAllBooksMetadata()
 * 
 * // 显示书架
 * books.forEach(book => {
 *   console.log(`${book.title} - ${book.category}`)
 * })
 * 
 * // 按分类筛选
 * const gameBooks = books.filter(b => b.category === '游戏史记')
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
 * 
 * @param {string} bookId - 书籍ID
 * @returns {boolean} 是否有效
 * 
 * @description
 * 检查书籍ID是否存在于元数据列表中。
 * 
 * @example
 * if (isValidBookId('02-01-san-nanyang')) {
 *   console.log('书籍ID有效')
 * } else {
 *   console.log('书籍不存在')
 * }
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
 * 
 * @async
 * @param {string} bookId - 书籍ID
 * @returns {Promise<void>}
 * 
 * @description
 * 在后台预加载书籍数据，提升用户体验。
 * 如果书籍已在缓存中，则不会重复加载。
 * 
 * @example
 * // 用户浏览书架时，预加载可能打开的书籍
 * const popularBooks = ['02-01-san-nanyang', '02-02-diary-chao']
 * popularBooks.forEach(bookId => {
 *   preloadBookData(bookId).catch(err => {
 *     console.warn('预加载失败:', bookId)
 *   })
 * })
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
 * 
 * @param {string} [bookId] - 书籍ID，不传则清除所有缓存
 * 
 * @description
 * 清除指定书籍或所有书籍的缓存数据。
 * 用于释放内存或强制重新加载数据。
 * 
 * @example
 * // 清除单个书籍缓存
 * clearBookCache('02-01-san-nanyang')
 * 
 * // 清除所有缓存
 * clearBookCache()
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
 * 
 * @returns {Object} 缓存统计
 * @returns {string[]} return.cachedBooks - 已缓存的书籍ID列表
 * @returns {number} return.cacheSize - 缓存的书籍数量
 * 
 * @description
 * 获取当前缓存状态，用于监控和调试。
 * 
 * @example
 * const info = getCacheInfo()
 * console.log(`已缓存 ${info.cacheSize} 本书`)
 * console.log('书籍列表:', info.cachedBooks)
 * 
 * // 检查特定书籍是否已缓存
 * if (info.cachedBooks.includes('02-01-san-nanyang')) {
 *   console.log('书籍已在缓存中')
 * }
 */
export function getCacheInfo() {
  return {
    cachedBooks: Array.from(booksContentCache.keys()),
    cacheSize: booksContentCache.size
  }
}
