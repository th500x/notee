/**
 * BookReader自定义Hook
 * 提取BookReader组件的业务逻辑
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBook } from '../contexts/BookContext'
import { PAGINATION_CONFIG, LOG_PREFIX } from '../constants'
import { splitContentIntoPages } from '../utils/contentPagination'

/**
 * BookReader Hook
 * @param {string} bookId - 书籍ID
 * @param {string} chapterId - 章节ID
 * @returns {Object} BookReader状态和方法
 */
export function useBookReader(bookId, chapterId) {
  const navigate = useNavigate()
  const { getBook, saveReadingProgress, getReadingProgress } = useBook()
  
  const [currentBook, setCurrentBook] = useState(null)
  const [globalPageIndex, setGlobalPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 构建全局页面列表（带缓存）
  const allPages = useMemo(() => {
    if (!currentBook) return []
    
    console.log(`${LOG_PREFIX.BOOK_READER} 构建页面列表`)
    const pages = []
    
    currentBook.chapters.forEach((chapter) => {
      const chapterPages = splitContentIntoPages(
        chapter.content,
        PAGINATION_CONFIG.CHARS_PER_PAGE
      )
      
      chapterPages.forEach((pageContent) => {
        pages.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          content: pageContent
        })
      })
    })
    
    console.log(`${LOG_PREFIX.BOOK_READER} 总页数:`, pages.length)
    return pages
  }, [currentBook])

  const totalPages = allPages.length
  const currentPageData = allPages[globalPageIndex]

  // 加载书籍
  useEffect(() => {
    const loadBook = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const book = getBook(bookId)
        if (!book) {
          throw new Error('书籍不存在')
        }
        
        setCurrentBook(book)
        
        // 如果指定了章节，跳到该章节的第一页
        if (chapterId && book) {
          const chapterIndex = book.chapters.findIndex(c => c.id === chapterId)
          if (chapterIndex >= 0) {
            // 计算该章节在全局页面中的起始索引
            let pageIndex = 0
            for (let i = 0; i < chapterIndex; i++) {
              const chapterPages = splitContentIntoPages(
                book.chapters[i].content,
                PAGINATION_CONFIG.CHARS_PER_PAGE
              )
              pageIndex += chapterPages.length
            }
            setGlobalPageIndex(pageIndex)
            saveReadingProgress(bookId, chapterId)
          }
        }
      } catch (err) {
        console.error(`${LOG_PREFIX.BOOK_READER} 加载失败:`, err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    loadBook()
  }, [bookId, chapterId, getBook, saveReadingProgress])

  // 翻页方法
  const goToPrevPage = useCallback(() => {
    if (globalPageIndex > 0) {
      setGlobalPageIndex(prev => prev - 1)
      window.scrollTo(0, 0)
    }
  }, [globalPageIndex])

  const goToNextPage = useCallback(() => {
    if (globalPageIndex < totalPages - 1) {
      setGlobalPageIndex(prev => prev + 1)
      window.scrollTo(0, 0)
    }
  }, [globalPageIndex, totalPages])

  const goToPage = useCallback((pageIndex) => {
    if (pageIndex >= 0 && pageIndex < totalPages) {
      setGlobalPageIndex(pageIndex)
      window.scrollTo(0, 0)
    }
  }, [totalPages])

  // 章节切换
  const handleChapterChange = useCallback((newChapterId) => {
    navigate(`/book/${bookId}/chapter/${newChapterId}`)
  }, [bookId, navigate])

  const handleBackToShelf = useCallback(() => {
    navigate('/')
  }, [navigate])

  // 计算阅读进度
  const readingProgress = useMemo(() => {
    return totalPages > 0 ? ((globalPageIndex + 1) / totalPages) * 100 : 0
  }, [globalPageIndex, totalPages])

  return {
    // 状态
    currentBook,
    currentPageData,
    globalPageIndex,
    totalPages,
    loading,
    error,
    readingProgress,
    
    // 方法
    goToPrevPage,
    goToNextPage,
    goToPage,
    handleChapterChange,
    handleBackToShelf,
    
    // 能力判断
    canGoPrev: globalPageIndex > 0,
    canGoNext: globalPageIndex < totalPages - 1
  }
}
