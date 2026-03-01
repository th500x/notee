/**
 * 本地存储服务
 * 统一管理localStorage的读写操作
 */

import { STORAGE_KEYS, LOG_PREFIX } from '../constants'

/**
 * 保存阅读进度
 * @param {string} bookId - 书籍ID
 * @param {string} chapterId - 章节ID
 * @param {number} position - 阅读位置
 * @returns {boolean} 是否保存成功
 */
export function saveReadingProgress(bookId, chapterId, position = 0) {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.READING_PROGRESS)
    const progress = stored ? JSON.parse(stored) : {}
    
    progress[bookId] = {
      currentChapter: chapterId,
      position: position,
      lastRead: new Date().toISOString()
    }
    
    localStorage.setItem(STORAGE_KEYS.READING_PROGRESS, JSON.stringify(progress))
    return true
  } catch (error) {
    console.error(`${LOG_PREFIX.BOOK_CONTEXT} 保存阅读进度失败:`, error)
    
    // 处理存储空间不足
    if (error.name === 'QuotaExceededError') {
      console.warn(`${LOG_PREFIX.BOOK_CONTEXT} 存储空间不足，尝试清理旧数据`)
      cleanOldProgress()
      // 重试一次
      try {
        localStorage.setItem(STORAGE_KEYS.READING_PROGRESS, JSON.stringify({ [bookId]: progress[bookId] }))
        return true
      } catch (retryError) {
        return false
      }
    }
    
    return false
  }
}

/**
 * 获取阅读进度
 * @param {string} bookId - 书籍ID
 * @returns {Object|null} 阅读进度
 */
export function getReadingProgress(bookId) {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.READING_PROGRESS)
    if (!stored) return null
    
    const progress = JSON.parse(stored)
    return progress[bookId] || null
  } catch (error) {
    console.error(`${LOG_PREFIX.BOOK_CONTEXT} 读取阅读进度失败:`, error)
    return null
  }
}

/**
 * 保存书签
 * @param {string} bookId - 书籍ID
 * @param {string} chapterId - 章节ID
 * @param {number} position - 位置
 * @param {string} note - 备注
 * @returns {string|null} 书签ID
 */
export function saveBookmark(bookId, chapterId, position, note = '') {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.BOOKMARKS)
    const bookmarks = stored ? JSON.parse(stored) : {}
    
    const bookmarkId = `${bookId}-${chapterId}-${Date.now()}`
    
    if (!bookmarks[bookId]) {
      bookmarks[bookId] = {}
    }
    
    bookmarks[bookId][bookmarkId] = {
      chapterId,
      position,
      note,
      createdAt: new Date().toISOString()
    }
    
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks))
    return bookmarkId
  } catch (error) {
    console.error(`${LOG_PREFIX.BOOK_CONTEXT} 保存书签失败:`, error)
    return null
  }
}

/**
 * 获取书签
 * @param {string} bookId - 书籍ID
 * @returns {Object} 书签对象
 */
export function getBookmarks(bookId) {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.BOOKMARKS)
    if (!stored) return {}
    
    const bookmarks = JSON.parse(stored)
    return bookmarks[bookId] || {}
  } catch (error) {
    console.error(`${LOG_PREFIX.BOOK_CONTEXT} 读取书签失败:`, error)
    return {}
  }
}

/**
 * 清理旧的阅读进度（保留最近30天）
 */
function cleanOldProgress() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.READING_PROGRESS)
    if (!stored) return
    
    const progress = JSON.parse(stored)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const cleaned = {}
    Object.keys(progress).forEach(bookId => {
      const lastRead = new Date(progress[bookId].lastRead)
      if (lastRead > thirtyDaysAgo) {
        cleaned[bookId] = progress[bookId]
      }
    })
    
    localStorage.setItem(STORAGE_KEYS.READING_PROGRESS, JSON.stringify(cleaned))
    console.log(`${LOG_PREFIX.BOOK_CONTEXT} 清理完成，保留 ${Object.keys(cleaned).length} 条记录`)
  } catch (error) {
    console.error(`${LOG_PREFIX.BOOK_CONTEXT} 清理失败:`, error)
  }
}

/**
 * 获取存储使用情况
 * @returns {Object} 存储信息
 */
export function getStorageInfo() {
  try {
    let totalSize = 0
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalSize += localStorage[key].length + key.length
      }
    }
    
    return {
      used: totalSize,
      usedKB: (totalSize / 1024).toFixed(2),
      usedMB: (totalSize / 1024 / 1024).toFixed(2)
    }
  } catch (error) {
    return { used: 0, usedKB: '0', usedMB: '0' }
  }
}
