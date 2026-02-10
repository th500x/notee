import { useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

function ReadingToolbar({ 
  book, 
  chapter, 
  onToggleNavigation, 
  onBackToShelf, 
  onPrevChapter, 
  onNextChapter,
  canGoPrev,
  canGoNext 
}) {
  const [isExporting, setIsExporting] = useState(false)

  // 导出PDF功能 - 使用canvas截图方式支持中文
  const handleExportPDF = async () => {
    if (!window.confirm(`确定要导出《${book.title}》为PDF吗？\n\n注意：导出过程可能需要一些时间，请耐心等待。`)) {
      return
    }

    setIsExporting(true)
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = 210 // A4宽度
      const pageHeight = 297 // A4高度
      
      // 创建临时容器用于渲染内容
      const tempContainer = document.createElement('div')
      tempContainer.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: 800px;
        background: white;
        padding: 40px;
        font-family: 'Noto Serif SC', serif;
      `
      document.body.appendChild(tempContainer)
      
      // 添加标题页
      tempContainer.innerHTML = `
        <div style="text-align: center; padding: 100px 40px;">
          <h1 style="font-size: 32px; margin-bottom: 20px; color: #2c1810;">${book.title}</h1>
          <p style="font-size: 18px; color: #666; margin-bottom: 40px;">${book.description}</p>
          <p style="font-size: 14px; color: #999;">导出时间: ${new Date().toLocaleDateString('zh-CN')}</p>
        </div>
      `
      
      const titleCanvas = await html2canvas(tempContainer, { 
        scale: 1.5,
        logging: false,
        useCORS: true
      })
      const titleImgData = titleCanvas.toDataURL('image/jpeg', 1.0)
      const titleImgHeight = (titleCanvas.height * pageWidth) / titleCanvas.width
      pdf.addImage(titleImgData, 'JPEG', 0, 0, pageWidth, Math.min(titleImgHeight, pageHeight))
      
      // 添加目录
      pdf.addPage()
      tempContainer.innerHTML = `
        <div style="padding: 40px;">
          <h2 style="font-size: 24px; margin-bottom: 30px; color: #2c1810;">目录</h2>
          ${book.chapters.map((chap, index) => 
            `<p style="font-size: 16px; margin: 10px 0; color: #333;">${index + 1}. ${chap.title}</p>`
          ).join('')}
        </div>
      `
      
      const tocCanvas = await html2canvas(tempContainer, { 
        scale: 1.5,
        logging: false,
        useCORS: true
      })
      const tocImgData = tocCanvas.toDataURL('image/jpeg', 1.0)
      const tocImgHeight = (tocCanvas.height * pageWidth) / tocCanvas.width
      pdf.addImage(tocImgData, 'JPEG', 0, 0, pageWidth, Math.min(tocImgHeight, pageHeight))
      
      // 添加每个章节
      for (let i = 0; i < book.chapters.length; i++) {
        const chap = book.chapters[i]
        pdf.addPage()
        
        // 渲染章节内容
        const content = chap.content
          .replace(/\*（.*?）\*/g, '') // 移除图片占位符
          .replace(/^# /gm, '')
          .replace(/^## /gm, '')
          .replace(/\n\n+/g, '\n\n')
        
        tempContainer.innerHTML = `
          <div style="padding: 40px; line-height: 1.8;">
            <h2 style="font-size: 22px; margin-bottom: 30px; color: #2c1810; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
              第${i + 1}章 ${chap.title}
            </h2>
            <div style="font-size: 14px; color: #333; white-space: pre-wrap;">${content}</div>
          </div>
        `
        
        const chapterCanvas = await html2canvas(tempContainer, { 
          scale: 1.5,
          logging: false,
          useCORS: true
        })
        const chapterImgData = chapterCanvas.toDataURL('image/jpeg', 1.0)
        const chapterImgHeight = (chapterCanvas.height * pageWidth) / chapterCanvas.width
        
        // 如果内容太长，分页处理
        if (chapterImgHeight > pageHeight) {
          let currentY = 0
          while (currentY < chapterCanvas.height) {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            const sliceHeight = (pageHeight * chapterCanvas.width) / pageWidth
            
            canvas.width = chapterCanvas.width
            canvas.height = Math.min(sliceHeight, chapterCanvas.height - currentY)
            
            ctx.drawImage(
              chapterCanvas,
              0, currentY,
              chapterCanvas.width, canvas.height,
              0, 0,
              canvas.width, canvas.height
            )
            
            const sliceImgData = canvas.toDataURL('image/jpeg', 1.0)
            const sliceImgHeight = (canvas.height * pageWidth) / canvas.width
            
            if (currentY > 0) pdf.addPage()
            pdf.addImage(sliceImgData, 'JPEG', 0, 0, pageWidth, sliceImgHeight)
            
            currentY += sliceHeight
          }
        } else {
          pdf.addImage(chapterImgData, 'JPEG', 0, 0, pageWidth, chapterImgHeight)
        }
      }
      
      // 清理临时容器
      document.body.removeChild(tempContainer)
      
      // 保存PDF
      pdf.save(`${book.title}.pdf`)
      
      alert('PDF导出成功！')
    } catch (error) {
      console.error('PDF导出失败:', error)
      alert('PDF导出失败，请稍后重试。\n\n错误信息：' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="sticky top-4 z-40">
      <div className="toolbar flex items-center justify-between px-6 py-3 mx-auto max-w-4xl">
        {/* 左侧导航 */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onBackToShelf}
            className="toolbar-button"
            title="返回书架"
          >
            📚 书架
          </button>
          
          <button
            onClick={onToggleNavigation}
            className="toolbar-button"
            title="章节导航"
          >
            📖 目录
          </button>
        </div>

        {/* 中间标题 */}
        <div className="text-center flex-1 mx-4">
          <div className="font-medium text-ink text-sm truncate">
            {book.title}
          </div>
          {chapter && (
            <div className="text-xs text-gray-600 truncate">
              {chapter.title}
            </div>
          )}
        </div>

        {/* 右侧操作 */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onPrevChapter}
            disabled={!canGoPrev}
            className="toolbar-button disabled:opacity-50 disabled:cursor-not-allowed"
            title="上一页 (快捷键: ←)"
          >
            ← 上一页
          </button>
          
          <button
            onClick={onNextChapter}
            disabled={!canGoNext}
            className="toolbar-button disabled:opacity-50 disabled:cursor-not-allowed"
            title="下一页 (快捷键: →)"
          >
            下一页 →
          </button>
          
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="toolbar-button disabled:opacity-50"
            title="导出PDF"
          >
            {isExporting ? '📄 导出中...' : '📄 导出'}
          </button>
        </div>
      </div>

      {/* 移动端简化工具栏 */}
      <div className="lg:hidden">
        <div className="toolbar flex items-center justify-between px-4 py-2 mx-4">
          <button
            onClick={onBackToShelf}
            className="text-sm px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200"
          >
            📚
          </button>
          
          <button
            onClick={onToggleNavigation}
            className="text-sm px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200"
          >
            📖
          </button>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={onPrevChapter}
              disabled={!canGoPrev}
              className="text-sm px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              ←
            </button>
            <button
              onClick={onNextChapter}
              disabled={!canGoNext}
              className="text-sm px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              →
            </button>
          </div>
          
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="text-sm px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            📄
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReadingToolbar