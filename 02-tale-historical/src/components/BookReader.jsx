import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBook } from '../contexts/BookContext'
import { useReadingSettings } from '../hooks/useReadingSettings'
import { splitContentIntoPages } from '../utils/contentPagination'
import { LOG_PREFIX } from '../constants'
import ChapterNavigation from './ChapterNavigation'
import ReadingToolbar from './ReadingToolbar'

function BookReader() {
  const { bookId, chapterId } = useParams()
  const navigate = useNavigate()
  const { getBook, saveReadingProgress, getReadingProgress } = useBook()
  
  const [currentBook, setCurrentBook] = useState(null)
  const [showNavigation, setShowNavigation] = useState(false)
  const [globalPageIndex, setGlobalPageIndex] = useState(0)

  // 使用阅读设置Hook
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

  // 构建全局页面列表
  const allPages = useMemo(() => {
    if (!currentBook) return []
    
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
    return pages
  }, [currentBook])

  const totalPages = allPages.length
  const currentPageData = allPages[globalPageIndex]

  useEffect(() => {
    console.log(`${LOG_PREFIX.BOOK_READER} 加载书籍: ${bookId}, 章节: ${chapterId}`)
    const book = getBook(bookId)
    if (!book) {
      console.warn(`${LOG_PREFIX.BOOK_READER} 书籍不存在: ${bookId}`)
      navigate('/', { replace: true })
      return
    }
    
    setCurrentBook(book)
    
    // 如果指定了章节，跳到该章节的第一页
    if (chapterId && book) {
      const chapterIndex = book.chapters.findIndex(c => c.id === chapterId)
      if (chapterIndex >= 0) {
        // 计算该章节在全局页面中的起始索引
        let pageIndex = 0
        for (let i = 0; i < chapterIndex; i++) {
          const chapterPages = splitContentIntoPages(book.chapters[i].content)
          pageIndex += chapterPages.length
        }
        console.log(`${LOG_PREFIX.BOOK_READER} 跳转到章节页面: ${pageIndex}`)
        setGlobalPageIndex(pageIndex)
        saveReadingProgress(bookId, chapterId)
      }
    }
  }, [bookId, chapterId, getBook, navigate, saveReadingProgress])

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

  // 渲染内容 - 使用React元素,保持段落连贯性
  const renderContent = (content) => {
    if (!content) return null
    
    // 获取当前字体设置
    const currentFontFamily = getCurrentFont()
    const baseFontSize = fontSize
    const baseLineHeight = lineHeight
    
    // 统一的样式对象
    const baseStyle = {
      fontSize: `${baseFontSize}px`,
      lineHeight: baseLineHeight,
      fontFamily: currentFontFamily,
      color: '#2c1810'
    }
    
    const h1Style = {
      fontSize: `${baseFontSize * 2}px`,
      lineHeight: baseLineHeight,
      fontFamily: currentFontFamily,
      fontWeight: '700',
      color: '#8b4513',
      margin: '2rem 0',
      borderBottom: '2px solid #d4af37',
      paddingBottom: '1rem'
    }
    
    const h2Style = {
      fontSize: `${baseFontSize * 1.5}px`,
      lineHeight: baseLineHeight,
      fontFamily: currentFontFamily,
      fontWeight: '600',
      color: '#a0522d',
      margin: '1.5rem 0 1rem 0'
    }
    
    const paragraphStyle = {
      ...baseStyle,
      margin: '1rem 0'
    }
    
    // 处理markdown加粗语法
    const processMarkdown = (text) => {
      const parts = []
      let lastIndex = 0
      const boldRegex = /\*\*(.*?)\*\*/g
      let match
      
      while ((match = boldRegex.exec(text)) !== null) {
        // 添加加粗前的文本
        if (match.index > lastIndex) {
          parts.push(text.substring(lastIndex, match.index))
        }
        // 添加加粗文本
        parts.push(<strong key={`bold-${match.index}`} style={{ fontWeight: '600' }}>{match[1]}</strong>)
        lastIndex = match.index + match[0].length
      }
      
      // 添加剩余文本
      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex))
      }
      
      return parts.length > 0 ? parts : text
    }
    
    const imageRegex = /\*（(.*?)）\*/g
    const parts = content.split(imageRegex)
    
    return (
      <div style={baseStyle}>
        {parts.map((part, index) => {
          if (index % 2 === 1) {
            const imageKey = part.trim()
            const imageUrl = currentBook?.images?.[imageKey]
            
            if (imageUrl) {
              return (
                <div key={`img-${index}`} className="my-8 text-center">
                  <img 
                    src={imageUrl} 
                    alt={imageKey}
                    className="max-w-full h-auto rounded-lg shadow-lg mx-auto"
                    style={{ maxHeight: '600px' }}
                  />
                </div>
              )
            }
          } else if (part.trim()) {
            // 按行处理内容,但保持段落连贯
            const lines = part.split('\n')
            const elements = []
            let currentParagraph = []
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim()
              
              if (line.startsWith('# ')) {
                // 先输出当前段落
                if (currentParagraph.length > 0) {
                  elements.push(
                    <p key={`p-${index}-${elements.length}`} style={paragraphStyle}>
                      {currentParagraph.map((item, idx) => {
                        if (item === 'br-separator') {
                          return <br key={`br-${idx}`} />
                        }
                        return <span key={`text-${idx}`}>{processMarkdown(item)}</span>
                      })}
                    </p>
                  )
                  currentParagraph = []
                }
                // 输出h1
                elements.push(
                  <h1 key={`h1-${index}-${i}`} style={h1Style}>
                    {processMarkdown(line.substring(2))}
                  </h1>
                )
              } else if (line.startsWith('## ')) {
                // 先输出当前段落
                if (currentParagraph.length > 0) {
                  elements.push(
                    <p key={`p-${index}-${elements.length}`} style={paragraphStyle}>
                      {currentParagraph.map((item, idx) => {
                        if (item === 'br-separator') {
                          return <br key={`br-${idx}`} />
                        }
                        return <span key={`text-${idx}`}>{processMarkdown(item)}</span>
                      })}
                    </p>
                  )
                  currentParagraph = []
                }
                // 输出h2
                elements.push(
                  <h2 key={`h2-${index}-${i}`} style={h2Style}>
                    {processMarkdown(line.substring(3))}
                  </h2>
                )
              } else if (line === '') {
                // 空行表示段落结束
                if (currentParagraph.length > 0) {
                  elements.push(
                    <p key={`p-${index}-${elements.length}`} style={paragraphStyle}>
                      {currentParagraph.map((item, idx) => {
                        if (item === 'br-separator') {
                          return <br key={`br-${idx}`} />
                        }
                        return <span key={`text-${idx}`}>{processMarkdown(item)}</span>
                      })}
                    </p>
                  )
                  currentParagraph = []
                }
              } else {
                // 普通文本行,添加到当前段落
                if (currentParagraph.length > 0) {
                  currentParagraph.push('br-separator')
                }
                currentParagraph.push(line)
              }
            }
            
            // 输出最后的段落
            if (currentParagraph.length > 0) {
              elements.push(
                <p key={`p-${index}-${elements.length}`} style={paragraphStyle}>
                  {currentParagraph.map((item, idx) => {
                    if (item === 'br-separator') {
                      return <br key={`br-${idx}`} />
                    }
                    return <span key={`text-${idx}`}>{processMarkdown(item)}</span>
                  })}
                </p>
              )
            }
            
            return elements
          }
          return null
        })}
      </div>
    )
  }

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

  // 如果没有选择章节，显示目录
  if (!chapterId) {
    const progress = getReadingProgress(bookId)
    
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-ink font-title mb-4">{currentBook.title}</h1>
            <p className="text-gray-600 text-lg">{currentBook.description}</p>
          </div>
          
          {progress && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-blue-800">上次阅读进度</span>
                <button
                  onClick={() => handleChapterChange(progress.currentChapter)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  继续阅读
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-semibold text-ink font-title mb-6">📖 目录</h2>
          <div className="space-y-3">
            {currentBook.chapters.map((chapter, index) => (
              <div
                key={chapter.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors group"
                onClick={() => handleChapterChange(chapter.id)}
              >
                <div className="flex items-center space-x-4">
                  <div className="text-2xl font-bold text-gold w-8">{index + 1}</div>
                  <div>
                    <h3 className="font-medium text-ink group-hover:text-wood transition-colors">
                      {chapter.title}
                    </h3>
                  </div>
                </div>
                <div className="text-gray-400 group-hover:text-gray-600">→</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={handleBackToShelf}
            className="bg-wood text-white px-6 py-3 rounded-lg hover:bg-opacity-90 transition-colors"
          >
            返回书架
          </button>
        </div>
      </div>
    )
  }

  const readingProgress = totalPages > 0 ? ((globalPageIndex + 1) / totalPages) * 100 : 0

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
      <div className="fixed top-20 right-4 bg-white rounded-lg shadow-lg p-4 z-10 hidden lg:block">
        <h4 className="text-sm font-medium text-gray-700 mb-3">阅读设置</h4>
        
        <div className="mb-3">
          <label htmlFor="font-family-select" className="text-xs text-gray-600 block mb-1">字体</label>
          <select
            id="font-family-select"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-gold"
          >
            {fontOptions.map(font => (
              <option key={font.value} value={font.value}>{font.label}</option>
            ))}
          </select>
        </div>
        
        <div className="mb-3">
          <div className="text-xs text-gray-600 block mb-1">字体大小</div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFontSize(Math.max(12, fontSize - 1))}
              className="w-6 h-6 bg-gray-200 rounded text-xs hover:bg-gray-300"
            >
              -
            </button>
            <span className="text-xs w-8 text-center">{fontSize}</span>
            <button
              onClick={() => setFontSize(Math.min(24, fontSize + 1))}
              className="w-6 h-6 bg-gray-200 rounded text-xs hover:bg-gray-300"
            >
              +
            </button>
          </div>
        </div>

        <div className="mb-3">
          <div className="text-xs text-gray-600 block mb-1">行高</div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setLineHeight(Math.max(1.2, lineHeight - 0.1))}
              className="w-6 h-6 bg-gray-200 rounded text-xs hover:bg-gray-300"
            >
              -
            </button>
            <span className="text-xs w-8 text-center">{lineHeight.toFixed(1)}</span>
            <button
              onClick={() => setLineHeight(Math.min(2.5, lineHeight + 0.1))}
              className="w-6 h-6 bg-gray-200 rounded text-xs hover:bg-gray-300"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* 章节内容 */}
      <div className="reading-page rounded-lg shadow-lg p-8 mt-6">
        {currentPageData && renderContent(currentPageData.content)}
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
