import { useState, useEffect, useRef, useMemo } from 'react'

function ChapterContent({ book, chapter, currentPage, onProgressUpdate, onPagesUpdate }) {
  const contentRef = useRef(null)
  const [fontSize, setFontSize] = useState(16)
  const [lineHeight, setLineHeight] = useState(1.8)
  const [fontFamily, setFontFamily] = useState('fangsong')

  const fontOptions = [
    { value: 'fangsong', label: '仿宋', family: "'FangSong', 'STFangsong', serif" },
    { value: 'kaiti', label: '楷体', family: "'KaiTi', 'STKaiti', serif" },
    { value: 'heiti', label: '黑体', family: "'SimHei', 'STHeiti', sans-serif" }
  ]

  const CHARS_PER_PAGE = 1800 // 每页字符数限制

  const getCurrentFont = () => {
    return fontOptions.find(f => f.value === fontFamily)?.family || fontOptions[0].family
  }

  // 将内容分页
  const pages = useMemo(() => {
    if (!chapter?.content) return []
    
    const content = chapter.content
    const imageRegex = /\*（(.*?)）\*/g
    
    // 按段落分割（保留标题和空行）
    const blocks = []
    let currentBlock = ''
    const lines = content.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // 如果是标题或分隔符，作为独立块
      if (line.startsWith('#') || line.trim() === '* * *') {
        if (currentBlock.trim()) {
          blocks.push(currentBlock)
          currentBlock = ''
        }
        blocks.push(line)
      } 
      // 如果是图片标记，作为独立块
      else if (imageRegex.test(line)) {
        if (currentBlock.trim()) {
          blocks.push(currentBlock)
          currentBlock = ''
        }
        blocks.push(line)
      }
      // 如果是空行且当前块有内容，结束当前块
      else if (line.trim() === '' && currentBlock.trim()) {
        blocks.push(currentBlock)
        currentBlock = ''
      }
      // 否则添加到当前块
      else if (line.trim()) {
        currentBlock += (currentBlock ? '\n' : '') + line
      }
    }
    
    if (currentBlock.trim()) {
      blocks.push(currentBlock)
    }
    
    // 将块组合成页
    const pageList = []
    let currentPageContent = []
    let currentPageChars = 0
    
    for (const block of blocks) {
      const blockChars = block.length
      
      // 如果是图片或标题，且当前页已有内容，可能需要新页
      if ((block.startsWith('#') || block.includes('*（')) && currentPageChars > CHARS_PER_PAGE * 0.5) {
        if (currentPageContent.length > 0) {
          pageList.push(currentPageContent.join('\n\n'))
          currentPageContent = []
          currentPageChars = 0
        }
      }
      
      // 如果添加这个块会超过限制，且当前页不为空，开始新页
      if (currentPageChars + blockChars > CHARS_PER_PAGE && currentPageContent.length > 0) {
        pageList.push(currentPageContent.join('\n\n'))
        currentPageContent = [block]
        currentPageChars = blockChars
      } else {
        currentPageContent.push(block)
        currentPageChars += blockChars
      }
    }
    
    // 添加最后一页
    if (currentPageContent.length > 0) {
      pageList.push(currentPageContent.join('\n\n'))
    }
    
    return pageList.length > 0 ? pageList : [content]
  }, [chapter?.content])

  const totalPages = pages.length
  const currentPageContent = pages[currentPage - 1] || ''

  // 通知父组件总页数
  useEffect(() => {
    onPagesUpdate(totalPages)
  }, [totalPages, onPagesUpdate])

  // 更新阅读进度（基于页码）
  useEffect(() => {
    const progress = (currentPage / totalPages) * 100
    onProgressUpdate(progress)
  }, [currentPage, totalPages, onProgressUpdate])

  // 处理图片插入点击
  const handleImagePlaceholderClick = (placeholderText) => {
    alert(`图片插入功能：${placeholderText}\n\n此功能将在后续版本中实现，您可以在此位置插入相关的游戏截图或插画。`)
  }

  // 渲染内容，处理特殊标记
  const renderContent = (content) => {
    // 处理图片插入标记
    const imageRegex = /\*（(.*?)）\*/g
    const parts = content.split(imageRegex)
    
    const elements = []
    
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index]
      
      if (index % 2 === 1) {
        // 这是图片插入标记
        const imageKey = part.trim()
        const imageUrl = book?.images?.[imageKey]
        
        if (imageUrl) {
          // 显示实际图片
          elements.push(
            <div 
              key={`img-${index}`}
              className="my-8 text-center"
            >
              <img 
                src={imageUrl} 
                alt={imageKey}
                className="max-w-full h-auto rounded-lg shadow-lg mx-auto"
                style={{ maxHeight: '600px' }}
              />
            </div>
          )
        } else {
          // 图片占位符（图片未找到）
          elements.push(
            <div 
              key={`placeholder-${index}`}
              className="my-6 p-4 border-2 border-dashed border-gold rounded-lg bg-yellow-50 text-center cursor-pointer hover:bg-yellow-100 transition-colors"
              onClick={() => handleImagePlaceholderClick(part)}
            >
              <div className="text-gold text-2xl mb-2">🖼️</div>
              <div className="text-sm text-gray-600">{part}</div>
              <div className="text-xs text-gray-500 mt-1">图片未找到，点击此处可添加</div>
            </div>
          )
        }
      } else if (part.trim()) {
        // 普通文本内容 - 添加内联样式确保字体大小一致
        let htmlContent = part
          .replace(/\n/g, '<br>')
        
        // 处理h1标签，添加内联样式
        htmlContent = htmlContent.replace(/^# (.*$)/gm, (match, title) => {
          return `<h1 style="font-size: ${fontSize * 2}px; line-height: ${lineHeight}; font-family: ${getCurrentFont()};">${title}</h1>`
        })
        
        // 处理h2标签，添加内联样式
        htmlContent = htmlContent.replace(/^## (.*$)/gm, (match, title) => {
          return `<h2 style="font-size: ${fontSize * 1.5}px; line-height: ${lineHeight}; font-family: ${getCurrentFont()};">${title}</h2>`
        })
        
        elements.push(
          <div 
            key={`text-${index}`}
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              fontFamily: getCurrentFont()
            }}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )
      }
    }
    
    return elements
  }

  return (
    <div className="relative">
      {/* 阅读设置面板 */}
      <div className="fixed top-20 right-4 bg-white rounded-lg shadow-lg p-4 z-10 hidden lg:block">
        <h4 className="text-sm font-medium text-gray-700 mb-3">阅读设置</h4>
        
        {/* 字体选择 */}
        <div className="mb-3">
          <label htmlFor="font-family-select" className="text-xs text-gray-600 block mb-1">字体</label>
          <select
            id="font-family-select"
            name="fontFamily"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-gold"
          >
            {fontOptions.map(font => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* 字体大小 */}
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

        {/* 行高 */}
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
      <div 
        ref={contentRef} 
        className="max-w-none chapter-content"
        style={{ 
          '--base-font-size': `${fontSize}px`,
          '--base-line-height': lineHeight,
          '--base-font-family': getCurrentFont()
        }}
      >
        {renderContent(currentPageContent)}
      </div>

      {/* 移动端阅读设置 */}
      <div className="lg:hidden fixed bottom-4 right-4 bg-white rounded-full shadow-lg">
        <button
          onClick={() => {
            const panel = document.querySelector('.mobile-reading-panel')
            panel.classList.toggle('hidden')
          }}
          className="w-12 h-12 bg-gold text-white rounded-full hover:bg-opacity-90 transition-colors"
        >
          ⚙️
        </button>
        
        <div className="mobile-reading-panel hidden absolute bottom-16 right-0 bg-white rounded-lg shadow-lg p-4 w-48">
          <div className="space-y-3">
            {/* 字体选择 */}
            <div>
              <label htmlFor="font-family-select-mobile" className="text-xs text-gray-600 block mb-1">字体</label>
              <select
                id="font-family-select-mobile"
                name="fontFamilyMobile"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1"
              >
                {fontOptions.map(font => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* 字体大小 */}
            <div>
              <div className="text-xs text-gray-600 block mb-1">字体大小</div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setFontSize(Math.max(12, fontSize - 1))}
                  className="flex-1 bg-gray-200 rounded py-1 text-xs hover:bg-gray-300"
                >
                  A-
                </button>
                <button
                  onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                  className="flex-1 bg-gray-200 rounded py-1 text-xs hover:bg-gray-300"
                >
                  A+
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChapterContent