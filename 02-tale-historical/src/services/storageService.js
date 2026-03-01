/**
 * 本地存储服务
 * 统一管理localStorage的读写操作，提供错误处理和数据清理功能
 * 
 * @module services/storageService
 * @description 
 * 该服务封装了所有localStorage操作，提供：
 * - 阅读进度管理
 * - 书签管理
 * - 自动清理旧数据
 * - 存储空间监控
 * 
 * @example
 * import * as storageService from './services/storageService'
 * 
 * // 保存阅读进度
 * storageService.saveReadingProgress('book-id', 'chapter-1', 0)
 * 
 * // 获取阅读进度
 * const progress = storageService.getReadingProgress('book-id')
 */

import { STORAGE_KEYS, LOG_PREFIX } from '../constants'

/**
 * 保存阅读进度
 * 
 * @param {string} bookId - 书籍ID
 * @param {string} chapterId - 章节ID
 * @param {number} [position=0] - 阅读位置（页码或滚动位置）
 * @returns {boolean} 是否保存成功
 * 
 * @description
 * 保存用户的阅读进度到localStorage。如果存储空间不足，
 * 会自动清理30天前的旧数据并重试。
 * 
 * @example
 * // 保存到第一页
 * const success = saveReadingProgress('02-01-san-nanyang', 'chapter-1', 0)
 * 
 * // 保存到第5页
 * saveReadingProgress('02-01-san-nanyang', 'chapter-2', 5)
 * 
 * @throws {Error} 当localStorage不可用时
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
 * 
 * @param {string} bookId - 书籍ID
 * @returns {Object|null} 阅读进度对象，如果不存在则返回null
 * @returns {string} return.currentChapter - 当前章节ID
 * @returns {number} return.position - 阅读位置
 * @returns {string} return.lastRead - 最后阅读时间（ISO格式）
 * 
 * @example
 * const progress = getReadingProgress('02-01-san-nanyang')
 * if (progress) {
 *   console.log(`上次读到: ${progress.currentChapter}`)
 *   console.log(`阅读时间: ${progress.lastRead}`)
 * }
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
 * 
 * @param {string} bookId - 书籍ID
 * @param {string} chapterId - 章节ID
 * @param {number} position - 书签位置（页码）
 * @param {string} [note=''] - 书签备注
 * @returns {string|null} 书签ID，失败时返回null
 * 
 * @description
 * 为指定位置添加书签。书签ID格式为：bookId-chapterId-timestamp
 * 
 * @example
 * // 添加简单书签
 * const bookmarkId = saveBookmark('02-01-san-nanyang', 'chapter-1', 5)
 * 
 * // 添加带备注的书签
 * saveBookmark('02-01-san-nanyang', 'chapter-1', 5, '重要段落')
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
 * 
 * @param {string} bookId - 书籍ID
 * @returns {Object} 书签对象，键为书签ID，值为书签详情
 * @returns {string} return[bookmarkId].chapterId - 章节ID
 * @returns {number} return[bookmarkId].position - 书签位置
 * @returns {string} return[bookmarkId].note - 书签备注
 * @returns {string} return[bookmarkId].createdAt - 创建时间
 * 
 * @example
 * const bookmarks = getBookmarks('02-01-san-nanyang')
 * Object.entries(bookmarks).forEach(([id, bookmark]) => {
 *   console.log(`书签: ${bookmark.note} - 第${bookmark.position}页`)
 * })
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
 * 清理旧的阅读进度
 * 
 * @private
 * @description
 * 删除30天前的阅读进度记录，释放存储空间。
 * 该函数在存储空间不足时自动调用。
 * 
 * @example
 * // 通常不需要手动调用，系统会自动清理
 * cleanOldProgress()
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
 * 
 * @returns {Object} 存储信息
 * @returns {number} return.used - 已使用字节数
 * @returns {string} return.usedKB - 已使用KB（保留2位小数）
 * @returns {string} return.usedMB - 已使用MB（保留2位小数）
 * 
 * @description
 * 计算localStorage的总使用量，包括所有键和值的大小。
 * 
 * @example
 * const info = getStorageInfo()
 * console.log(`已使用: ${info.usedKB} KB`)
 * 
 * // 检查是否接近限制（通常5-10MB）
 * if (parseFloat(info.usedMB) > 8) {
 *   console.warn('存储空间即将用完')
 * }
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
