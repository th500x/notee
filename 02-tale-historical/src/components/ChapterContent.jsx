/**
 * 章节内容渲染组件
 * 负责将Markdown格式的内容渲染为React元素
 */

import { useMemo } from 'react'

/**
 * 处理Markdown加粗语法
 * @param {string} text - 文本内容
 * @returns {Array} React元素数组
 */
function processMarkdown(text) {
  const parts = []
  let lastIndex = 0
  const boldRegex = /\*\*(.*?)\*\*/g
  let match
  
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    parts.push(
      <strong key={`bold-${match.index}`} style={{ fontWeight: '600' }}>
        {match[1]}
      </strong>
    )
    lastIndex = match.index + match[0].length
  }
  
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }
  
  return parts.length > 0 ? parts : text
}

/**
 * 渲染段落内容
 * @param {Array} paragraphLines - 段落行数组
 * @param {string} keyPrefix - key前缀
 * @param {Object} style - 样式对象
 * @returns {JSX.Element}
 */
function renderParagraph(paragraphLines, keyPrefix, style) {
  return (
    <p key={keyPrefix} style={style}>
      {paragraphLines.map((item, idx) => {
        if (item === 'br-separator') {
          return <br key={`br-${idx}`} />
        }
        return <span key={`text-${idx}`}>{processMarkdown(item)}</span>
      })}
    </p>
  )
}

/**
 * 章节内容组件
 */
function ChapterContent({ content, fontSize, lineHeight, fontFamily, book }) {
  // 计算样式
  const styles = useMemo(() => {
    const baseFontSize = fontSize
    const baseLineHeight = lineHeight
    
    return {
      base: {
        fontSize: `${baseFontSize}px`,
        lineHeight: baseLineHeight,
        fontFamily,
        color: '#2c1810'
      },
      h1: {
        fontSize: `${baseFontSize * 2}px`,
        lineHeight: baseLineHeight,
        fontFamily,
        fontWeight: '700',
        color: '#8b4513',
        margin: '2rem 0',
        borderBottom: '2px solid #d4af37',
        paddingBottom: '1rem'
      },
      h2: {
        fontSize: `${baseFontSize * 1.5}px`,
        lineHeight: baseLineHeight,
        fontFamily,
        fontWeight: '600',
        color: '#a0522d',
        margin: '1.5rem 0 1rem 0'
      },
      paragraph: {
        fontSize: `${baseFontSize}px`,
        lineHeight: baseLineHeight,
        fontFamily,
        color: '#2c1810',
        margin: '1rem 0'
      }
    }
  }, [fontSize, lineHeight, fontFamily])

  // 渲染内容
  const renderedContent = useMemo(() => {
    if (!content) return null
    
    const imageRegex = /\*（(.*?)）\*/g
    const parts = content.split(imageRegex)
    
    return parts.map((part, index) => {
      // 处理图片
      if (index % 2 === 1) {
        const imageKey = part.trim()
        const imageUrl = book?.images?.[imageKey]
        
        if (imageUrl) {
          return (
            <div key={`img-${index}`} className="my-8 text-center">
              <img 
                src={imageUrl} 
                alt={imageKey}
                className="max-w-full h-auto rounded-lg shadow-lg mx-auto"
                style={{ maxHeight: '600px' }}
                onError={(e) => {
                  console.warn(`[ChapterContent] 图片加载失败: ${imageKey}`)
                  e.target.style.display = 'none'
                }}
              />
            </div>
          )
        }
        return null
      }
      
      // 处理文本内容
      if (!part.trim()) return null
      
      const lines = part.split('\n')
      const elements = []
      let currentParagraph = []
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        // 一级标题
        if (line.startsWith('# ')) {
          if (currentParagraph.length > 0) {
            elements.push(
              renderParagraph(currentParagraph, `p-${index}-${elements.length}`, styles.paragraph)
            )
            currentParagraph = []
          }
          elements.push(
            <h1 key={`h1-${index}-${i}`} style={styles.h1}>
              {processMarkdown(line.substring(2))}
            </h1>
          )
        }
        // 二级标题
        else if (line.startsWith('## ')) {
          if (currentParagraph.length > 0) {
            elements.push(
              renderParagraph(currentParagraph, `p-${index}-${elements.length}`, styles.paragraph)
            )
            currentParagraph = []
          }
          elements.push(
            <h2 key={`h2-${index}-${i}`} style={styles.h2}>
              {processMarkdown(line.substring(3))}
            </h2>
          )
        }
        // 空行 - 段落结束
        else if (line === '') {
          if (currentParagraph.length > 0) {
            elements.push(
              renderParagraph(currentParagraph, `p-${index}-${elements.length}`, styles.paragraph)
            )
            currentParagraph = []
          }
        }
        // 普通文本行
        else {
          if (currentParagraph.length > 0) {
            currentParagraph.push('br-separator')
          }
          currentParagraph.push(line)
        }
      }
      
      // 输出最后的段落
      if (currentParagraph.length > 0) {
        elements.push(
          renderParagraph(currentParagraph, `p-${index}-${elements.length}`, styles.paragraph)
        )
      }
      
      return elements
    })
  }, [content, styles, book])

  if (!content) {
    return (
      <div className="text-center text-gray-500 py-12">
        <p>章节内容为空</p>
      </div>
    )
  }

  return (
    <div style={styles.base}>
      {renderedContent}
    </div>
  )
}

export default ChapterContent
