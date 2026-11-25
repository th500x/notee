import { useState, useLayoutEffect, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { buildOssImageUrl } from '../utils/ossImageUrl'

/**
 * 照片查看器
 * 账目单页面会横滑、缩放。按整页 fixed 铺开时，大图会落到当前屏幕外面，只在角落露出一块。
 * 这里按手机当前看得见的区域铺满，大图在这块区域里居中。
 * 多张时可用左右键翻图，Esc 关闭。
 */

function readVisibleScreen() {
  const vv = window.visualViewport
  if (!vv) {
    return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
  }
  return {
    top: vv.offsetTop,
    left: vv.offsetLeft,
    width: vv.width,
    height: vv.height
  }
}

function useVisibleScreen() {
  const [screen, setScreen] = useState(readVisibleScreen)
  useLayoutEffect(() => {
    const update = () => setScreen(readVisibleScreen())
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const vv = window.visualViewport
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
    }
  }, [])
  return screen
}

function PhotoViewer({ photos, initialIndex = 0, onClose }) {
  const list = Array.isArray(photos) ? photos : []
  const count = list.length
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const screen = useVisibleScreen()

  const goPrev = useCallback(() => {
    if (count <= 1) return
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : count - 1))
  }, [count])

  const goNext = useCallback(() => {
    if (count <= 1) return
    setCurrentIndex((prev) => (prev < count - 1 ? prev + 1 : 0))
  }, [count])

  useEffect(() => {
    if (count === 0) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }
      if (count <= 1) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [count, onClose, goPrev, goNext])

  if (count === 0) return null

  const currentPhoto = list[currentIndex] || list[0]
  const frameW = Math.max(1, Math.round(screen.width * 0.92))
  const frameH = Math.max(1, Math.round(screen.height * 0.86))

  const handlePrevious = (e) => {
    e.stopPropagation()
    goPrev()
  }

  const handleNext = (e) => {
    e.stopPropagation()
    goNext()
  }

  const handleDownload = (e) => {
    e.stopPropagation()
    const link = document.createElement('a')
    link.href = currentPhoto.url
    link.download = currentPhoto.name || `photo-${currentIndex + 1}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const node = (
    <div
      className="fixed z-[70] bg-black bg-opacity-90 overflow-hidden"
      style={{
        top: `${screen.top}px`,
        left: `${screen.left}px`,
        width: `${screen.width}px`,
        height: `${screen.height}px`
      }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300 z-10"
        title="关闭"
      >
        ✕
      </button>

      <div className="absolute top-4 left-4 text-white z-10">
        <p className="text-sm">
          {currentIndex + 1} / {count}
        </p>
        {currentPhoto.name && (
          <p className="text-xs text-gray-300 mt-1">{currentPhoto.name}</p>
        )}
      </div>

      <button
        onClick={handleDownload}
        className="absolute top-4 right-20 text-white text-xl hover:text-gray-300 z-10"
        title="下载照片"
      >
        ⬇️
      </button>

      {count > 1 && (
        <button
          onClick={handlePrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-5xl hover:text-gray-300 z-10"
          title="上一张"
        >
          ‹
        </button>
      )}

      <img
        src={buildOssImageUrl(currentPhoto.url, 'view')}
        alt={currentPhoto.name || '照片'}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain rounded-lg"
        style={{ maxWidth: `${frameW}px`, maxHeight: `${frameH}px` }}
        onClick={(e) => e.stopPropagation()}
      />

      {count > 1 && (
        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-5xl hover:text-gray-300 z-10"
          title="下一张"
        >
          ›
        </button>
      )}

      {count > 1 && (
        <div
          className="absolute bottom-3 left-1/2 z-10 max-w-[calc(100%-1.5rem)] -translate-x-1/2 overflow-x-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-2">
            {list.map((photo, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentIndex(index)
                }}
                className={`w-16 h-16 shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                  index === currentIndex
                    ? 'border-blue-500 scale-110'
                    : 'border-white border-opacity-50 hover:border-opacity-100'
                }`}
              >
                <img
                  src={buildOssImageUrl(photo.url, 'thumb')}
                  alt={`缩略图 ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(node, document.body)
}

export default PhotoViewer
