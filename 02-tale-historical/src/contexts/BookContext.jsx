import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { book_02_01_san_nanyang } from '../data/books/book-02-01-san-nanyang'
import { book_02_02_diary_chao } from '../data/books/book-02-02-diary-chao'
import { book_02_03_review_map } from '../data/books/book-02-03-review-map'
import { book_02_04_review_game } from '../data/books/book-02-04-review-game'
import { book_02_11_story_thailand } from '../data/books/book-02-11-story-thailand'
import { STORAGE_KEYS, LOG_PREFIX } from '../constants'

const BookContext = createContext()

export const useBook = () => {
  const context = useContext(BookContext)
  if (!context) {
    throw new Error('useBook must be used within a BookProvider')
  }
  return context
}

export const BookProvider = ({ children }) => {
  const [books, setBooks] = useState([])
  const [readingProgress, setReadingProgress] = useState({})
  const [bookmarks, setBookmarks] = useState({})

  // 初始化书籍数据
  useEffect(() => {
    console.log(`${LOG_PREFIX.BOOK_CONTEXT} 初始化书籍数据`)
    
    const initialBooks = [
      book_02_01_san_nanyang,
      book_02_02_diary_chao,
      book_02_03_review_map,
      book_02_04_review_game,
      book_02_11_story_thailand,
      // 未来的书籍在这里添加
    ]
    
    setBooks(initialBooks)
    
    // 从本地存储加载阅读进度
    const savedProgress = localStorage.getItem(STORAGE_KEYS.READING_PROGRESS)
    if (savedProgress) {
      try {
        setReadingProgress(JSON.parse(savedProgress))
        console.log(`${LOG_PREFIX.BOOK_CONTEXT} 加载阅读进度成功`)
      } catch (e) {
        console.error(`${LOG_PREFIX.BOOK_CONTEXT} 加载阅读进度失败:`, e)
      }
    }
    
    // 从本地存储加载书签
    const savedBookmarks = localStorage.getItem(STORAGE_KEYS.BOOKMARKS)
    if (savedBookmarks) {
      try {
        setBookmarks(JSON.parse(savedBookmarks))
        console.log(`${LOG_PREFIX.BOOK_CONTEXT} 加载书签成功`)
      } catch (e) {
        console.error(`${LOG_PREFIX.BOOK_CONTEXT} 加载书签失败:`, e)
      }
    }
  }, [])

  // 保存阅读进度
  const saveReadingProgress = useCallback((bookId, chapterId, position = 0) => {
    setReadingProgress(prev => {
      const newProgress = {
        ...prev,
        [bookId]: {
          currentChapter: chapterId,
          position: position,
          lastRead: new Date().toISOString()
        }
      }
      try {
        localStorage.setItem(STORAGE_KEYS.READING_PROGRESS, JSON.stringify(newProgress))
        console.log(`${LOG_PREFIX.BOOK_CONTEXT} 保存阅读进度:`, bookId, chapterId)
      } catch (e) {
        console.error(`${LOG_PREFIX.BOOK_CONTEXT} 保存阅读进度失败:`, e)
      }
      return newProgress
    })
  }, [])

  // 添加书签
  const addBookmark = useCallback((bookId, chapterId, position, note = '') => {
    const bookmarkId = `${bookId}-${chapterId}-${Date.now()}`
    setBookmarks(prev => {
      const newBookmarks = {
        ...prev,
        [bookId]: {
          ...prev[bookId],
          [bookmarkId]: {
            chapterId,
            position,
            note,
            createdAt: new Date().toISOString()
          }
        }
      }
      try {
        localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(newBookmarks))
        console.log(`${LOG_PREFIX.BOOK_CONTEXT} 添加书签:`, bookId, chapterId)
      } catch (e) {
        console.error(`${LOG_PREFIX.BOOK_CONTEXT} 添加书签失败:`, e)
      }
      return newBookmarks
    })
  }, [])

  // 获取书籍
  const getBook = useCallback((bookId) => {
    return books.find(book => book.id === bookId)
  }, [books])

  // 获取章节
  const getChapter = useCallback((bookId, chapterId) => {
    const book = books.find(book => book.id === bookId)
    if (!book) return null
    return book.chapters.find(chapter => chapter.id === chapterId)
  }, [books])

  // 获取阅读进度
  const getReadingProgress = useCallback((bookId) => {
    // 直接从 localStorage 读取最新数据，避免依赖状态
    const stored = localStorage.getItem(STORAGE_KEYS.READING_PROGRESS)
    if (stored) {
      try {
        const progress = JSON.parse(stored)
        return progress[bookId] || null
      } catch (e) {
        console.error(`${LOG_PREFIX.BOOK_CONTEXT} 获取阅读进度失败:`, e)
        return null
      }
    }
    return null
  }, [])

  // 获取书签
  const getBookmarks = useCallback((bookId) => {
    // 直接从 localStorage 读取最新数据，避免依赖状态
    const stored = localStorage.getItem(STORAGE_KEYS.BOOKMARKS)
    if (stored) {
      try {
        const marks = JSON.parse(stored)
        return marks[bookId] || {}
      } catch (e) {
        console.error(`${LOG_PREFIX.BOOK_CONTEXT} 获取书签失败:`, e)
        return {}
      }
    }
    return {}
  }, [])

  const value = {
    books,
    readingProgress,
    bookmarks,
    saveReadingProgress,
    addBookmark,
    getBook,
    getChapter,
    getReadingProgress,
    getBookmarks
  }

  return (
    <BookContext.Provider value={value}>
      {children}
    </BookContext.Provider>
  )
}
