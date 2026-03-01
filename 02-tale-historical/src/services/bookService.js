/**
 * 书籍数据服务
 * 统一管理书籍数据的加载和访问
 */

import { LOG_PREFIX } from '../constants'

/**
 * 动态加载书籍数据
 * @param {string} bookId - 书籍ID
 * @returns {Promise<Object>} 书籍数据
 */
export async function loadBookData(bookId) {
  try {
    console.log(`${LOG_PREFIX.BOOK_CONTEXT} 加载书籍:`, bookId)
    
    // 动态导入书籍数据
    const module = await import(`../data/books/${bookId}.jsx`)
    const bookKey = `book_${bookId.replace(/-/g, '_')}`
    
    if (!module[bookKey]) {
      throw new Error(`书籍数据未找到: ${bookId}`)
    }
    
    return module[bookKey]
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
  return [
    {
      id: '02-01-san-nanyang',
      title: '三棋南阳史记',
      category: '游戏史记',
      loader: () => import('../data/books/book-02-01-san-nanyang')
    },
    {
      id: '02-02-diary-chao',
      title: '潮汕日记',
      category: '游记杂谈',
      loader: () => import('../data/books/book-02-02-diary-chao')
    },
    {
      id: '02-03-review-map',
      title: '地图回顾',
      category: '游戏史记',
      loader: () => import('../data/books/book-02-03-review-map')
    },
    {
      id: '02-04-review-game',
      title: '游戏回顾',
      category: '游戏史记',
      loader: () => import('../data/books/book-02-04-review-game')
    },
    {
      id: '02-11-story-thailand',
      title: '泰国故事',
      category: '游记杂谈',
      loader: () => import('../data/books/book-02-11-story-thailand')
    }
  ]
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
