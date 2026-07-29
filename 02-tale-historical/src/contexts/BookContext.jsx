import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { loadBooks } from '../data/loadBooks'
import { LOG_PREFIX } from '../constants'
import * as storageService from '../services/storageService'

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

  // 初始化书籍数据（由 src/data/books/<id>/ 自动扫描）
  useEffect(() => {
    console.log(`${LOG_PREFIX.BOOK_CONTEXT} 初始化书籍数据`)
    const initialBooks = loadBooks()
    setBooks(initialBooks)
    console.log(`${LOG_PREFIX.BOOK_CONTEXT} 初始化完成，共 ${initialBooks.length} 本`)
  }, [])

  // 保存阅读进度
  const saveReadingProgress = useCallback((bookId, chapterId, position = 0) => {
    // 验证参数
    if (!bookId || !chapterId) {
      console.warn(`${LOG_PREFIX.BOOK_CONTEXT} 保存进度参数不完整:`, { bookId, chapterId })
      return
    }
    
    if (typeof position !== 'number' || position < 0) {
      console.warn(`${LOG_PREFIX.BOOK_CONTEXT} 无效的位置参数:`, position)
      position = 0
    }
    
    const success = storageService.saveReadingProgress(bookId, chapterId, position)
    if (success) {
      console.log(`${LOG_PREFIX.BOOK_CONTEXT} 保存阅读进度:`, bookId, chapterId)
      // 更新本地状态（用于UI显示）
      setReadingProgress(prev => ({
        ...prev,
        [bookId]: {
          currentChapter: chapterId,
          position: position,
          lastRead: new Date().toISOString()
        }
      }))
    }
  }, [])

  // 添加书签
  const addBookmark = useCallback((bookId, chapterId, position, note = '') => {
    const bookmarkId = storageService.saveBookmark(bookId, chapterId, position, note)
    if (bookmarkId) {
      console.log(`${LOG_PREFIX.BOOK_CONTEXT} 添加书签:`, bookId, chapterId)
      // 更新本地状态
      setBookmarks(prev => ({
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
      }))
    }
  }, [])

  // 获取书籍
  const getBook = useCallback((bookId) => {
    // 验证bookId
    if (!bookId || typeof bookId !== 'string') {
      console.warn(`${LOG_PREFIX.BOOK_CONTEXT} 无效的书籍ID:`, bookId)
      return null
    }
    
    const book = books.find(book => book.id === bookId)
    
    if (!book) {
      console.warn(`${LOG_PREFIX.BOOK_CONTEXT} 书籍不存在:`, bookId)
    }
    
    return book || null
  }, [books])

  // 获取章节
  const getChapter = useCallback((bookId, chapterId) => {
    // 验证参数
    if (!bookId || !chapterId) {
      console.warn(`${LOG_PREFIX.BOOK_CONTEXT} 参数不完整:`, { bookId, chapterId })
      return null
    }
    
    const book = books.find(book => book.id === bookId)
    if (!book) {
      console.warn(`${LOG_PREFIX.BOOK_CONTEXT} 书籍不存在:`, bookId)
      return null
    }
    
    const chapter = book.chapters.find(chapter => chapter.id === chapterId)
    if (!chapter) {
      console.warn(`${LOG_PREFIX.BOOK_CONTEXT} 章节不存在:`, chapterId)
    }
    
    return chapter || null
  }, [books])

  // 获取阅读进度
  const getReadingProgress = useCallback((bookId) => {
    return storageService.getReadingProgress(bookId)
  }, [])

  // 获取书签
  const getBookmarks = useCallback((bookId) => {
    return storageService.getBookmarks(bookId)
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
