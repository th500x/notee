/**
 * 书籍阅读器主组件
 * 负责协调各个子组件，管理阅读状态
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBook } from '../contexts/BookContext'
import { useReadingSettings } from '../hooks/useReadingSettings'
import { splitContentIntoPages } from '../utils/contentPagination'
import { LOG_PREFIX } from '../constants'
import ChapterNavigation from './ChapterNavigation'
import ReadingToolbar from './ReadingToolbar'
import ChapterContent from './ChapterContent'
import ReadingSettingsPanel from './ReadingSettingsPanel'
import BookTableOfContents from './BookTableOfContents'

function BookReader() {
  const { bookId, chapterId } = useParams()
  const navigate = useNavigate()
  const { getBook, saveReadingProgress, getReadingProgress } = useBook()
  
  const [currentBook, setCurrentBook] = useState(null)
  const [showNavigation, setShowNavigation] = useState(false)
  const [globalPageIndex, setGlobalPageIndex] = useState(0)

  // 阅读设置
  const {
    fontSize,
    lineHeight,
    fontFamily,
    fontOptions,
    setFontSize,
    setLineHeight,
    setFontFamily,
    getCurrentFont
  } = useReadingSettings()

  // 分页缓存 - 避免重复计算
  const pagesCache = useRef(new Map())

  // 构建全局页面列表（带缓存）
  const allPages = useMemo(() => {
    if (!currentBook) return []
    
    const cacheKey = currentBook.id
    if (pagesCache.current.has(cacheKey)) {
      console.log(`${LOG_PREFIX.BOOK_READER} 使用缓存的页面列表`)
      return pagesCache.current.get(cacheKey)
    }
    
    console.log(`${LOG_PREFIX.BOOK_READER} 构建页面列表`)
    const pages = []
    currentBook.chapters.forEach((chapter) => {
      const chapterPages = splitContentIntoPages(chapter.content)
      chapterPages.forEach((pageContent) => {
        pages.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          content: pageContent
        })
      })
    })
    
    console.log(`${LOG_PREFIX.BOOK_READER} 总页数: ${pages.length}`)
    pagesCache.current.set(cacheKey, pages)
    return pages
  }, [currentBook])

  const totalPages = allPages.length
  const currentPageData = allPages[globalPageIndex]

  // 加载书籍
  useEffect(() => {
    console.log(`${LOG_PREFIX.BOOK_READER} 加载书籍: ${bookId}, 章节: ${chapterId}`)
    const book = getBook(bookId)
    
    if (!book) {
      console.warn(`${LOG_PREFIX.BOOK_READER} 书籍不存在: ${bookId}`)
      navigate('/', { replace: true })
      return
    }
    
    setCurrentBook(book)
    
    // 如果指定了章节，跳到该章节
    if (chapterId && book) {
      const chapterIndex = book.chapters.findIndex(c => c.id === chapterId)
      if (chapterIndex >= 0) {
        // 计算该章节在全局页面中的起始索引
        let chapterStartPage = 0
        for (let i = 0; i < chapterIndex; i++) {
          const chapterPages = splitContentIntoPages(book.chapters[i].content)
          chapterStartPage += chapterPages.length
        }
        
        // 尝试恢复之前的阅读进度
        const savedProgress = getReadingProgress(bookId)
        let targetPage = chapterStartPage // 默认跳到章节第一页
        
        if (savedProgress && savedProgress.currentChapter === chapterId) {
          // 如果保存的进度是当前章节，恢复到保存的页码
          const savedPosition = savedProgress.position || 0
          targetPage = chapterStartPage + savedPosition
          console.log(`${LOG_PREFIX.BOOK_READER} 恢复阅读进度到第 ${targetPage + 1} 页`)
        } else {
          console.log(`${LOG_PREFIX.BOOK_READER} 跳转到章节第一页: ${targetPage + 1}`)
        }
        
        setGlobalPageIndex(targetPage)
      }
    }
  }, [bookId, chapterId, getBook, navigate, getReadingProgress])

  // 保存阅读进度（当页码变化时）
  useEffect(() => {
    if (!currentBook || !currentPageData) return
    
    // 直接从currentPageData获取章节ID
    const currentChapterId = currentPageData.chapterId
    
    // 利用allPages直接计算当前页在章节中的相对位置
    const chapterStartIndex = allPages.findIndex(p => p.chapterId === currentChapterId)
    const positionInChapter = globalPageIndex - chapterStartIndex
    
    // 保存进度
    saveReadingProgress(bookId, currentChapterId, positionInChapter)
    console.log(`${LOG_PREFIX.BOOK_READER} 保存进度: 章节 ${currentChapterId}, 位置 ${positionInChapter}`)
  }, [globalPageIndex, currentPageData, bookId, saveReadingProgress, allPages])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPrevPage()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToNextPage()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [globalPageIndex, totalPages])

  // 事件处理
  const handleChapterChange = (newChapterId) => {
    navigate(`/book/${bookId}/chapter/${newChapterId}`)
    setShowNavigation(false)
  }

  const handleBackToShelf = () => {
    navigate('/')
  }

  const goToPrevPage = () => {
    if (globalPageIndex > 0) {
      setGlobalPageIndex(globalPageIndex - 1)
      window.scrollTo(0, 0)
    }
  }

  const goToNextPage = () => {
    if (globalPageIndex < totalPages - 1) {
      setGlobalPageIndex(globalPageIndex + 1)
      window.scrollTo(0, 0)
    }
  }

  // 加载状态
  if (!currentBook) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-medium mb-2">书籍不存在</h3>
          <button 
            onClick={handleBackToShelf}
            className="text-blue-600 hover:text-blue-800"
          >
            返回书架
          </button>
        </div>
      </div>
    )
  }

  // 显示目录
  if (!chapterId) {
    const progress = getReadingProgress(bookId)
    return (
      <BookTableOfContents
        book={currentBook}
        progress={progress}
        onChapterSelect={handleChapterChange}
        onBackToShelf={handleBackToShelf}
      />
    )
  }

  // 计算阅读进度
  const readingProgress = totalPages > 0 ? ((globalPageIndex + 1) / totalPages) * 100 : 0

  // 阅读器主界面
  return (
    <div className="max-w-4xl mx-auto relative pb-32">
      {/* 阅读进度条 */}
      <div 
        className="reading-progress"
        style={{ width: `${readingProgress}%` }}
      />

      {/* 工具栏 */}
      <ReadingToolbar
        book={currentBook}
        chapter={currentPageData ? { title: currentPageData.chapterTitle } : currentBook.chapters[0]}
        onToggleNavigation={() => setShowNavigation(!showNavigation)}
        onBackToShelf={handleBackToShelf}
        onPrevChapter={goToPrevPage}
        onNextChapter={goToNextPage}
        canGoPrev={globalPageIndex > 0}
        canGoNext={globalPageIndex < totalPages - 1}
      />

      {/* 章节导航 */}
      {showNavigation && (
        <ChapterNavigation
          book={currentBook}
          currentChapter={currentPageData ? { id: currentPageData.chapterId } : currentBook.chapters[0]}
          onChapterSelect={handleChapterChange}
          onClose={() => setShowNavigation(false)}
        />
      )}

      {/* 阅读设置面板 */}
      <ReadingSettingsPanel
        fontSize={fontSize}
        lineHeight={lineHeight}
        fontFamily={fontFamily}
        fontOptions={fontOptions}
        onFontSizeChange={setFontSize}
        onLineHeightChange={setLineHeight}
        onFontFamilyChange={setFontFamily}
      />

      {/* 章节内容 */}
      <div className="reading-page rounded-lg shadow-lg p-8 mt-6">
        {currentPageData && (
          <ChapterContent
            content={currentPageData.content}
            fontSize={fontSize}
            lineHeight={lineHeight}
            fontFamily={getCurrentFont()}
            book={currentBook}
          />
        )}
      </div>

      {/* 页面信息和导航 */}
      <div className="text-center mt-6 text-sm text-gray-500">
        第 {globalPageIndex + 1} / {totalPages} 页
        {currentPageData && ` · ${currentPageData.chapterTitle}`}
      </div>
    </div>
  )
}

export default BookReader
