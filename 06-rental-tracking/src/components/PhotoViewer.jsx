import { useState } from 'react'
import { buildOssImageUrl } from '../utils/ossImageUrl'

/**
 * 照片查看器组件
 * 
 * 功能：
 * - 显示照片大图
 * - 支持多张照片左右切换
 * - 点击背景关闭
 */
function PhotoViewer({ photos, initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  if (!photos || photos.length === 0) return null

  const currentPhoto = photos[currentIndex]

  const handlePrevious = (e) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
  }

  const handleNext = (e) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
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

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300 z-10"
        title="关闭"
      >
        ✕
      </button>

      {/* 照片信息 */}
      <div className="absolute top-4 left-4 text-white z-10">
        <p className="text-sm">
          {currentIndex + 1} / {photos.length}
        </p>
        {currentPhoto.name && (
          <p className="text-xs text-gray-300 mt-1">{currentPhoto.name}</p>
        )}
      </div>

      {/* 下载按钮 */}
      <button
        onClick={handleDownload}
        className="absolute top-4 right-20 text-white text-xl hover:text-gray-300 z-10"
        title="下载照片"
      >
        ⬇️
      </button>

      {/* 左箭头 */}
      {photos.length > 1 && (
        <button
          onClick={handlePrevious}
          className="absolute left-4 text-white text-5xl hover:text-gray-300 z-10"
          title="上一张"
        >
          ‹
        </button>
      )}

      {/* 照片 */}
      <div 
        className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={buildOssImageUrl(currentPhoto.url, 'view')}
          alt={currentPhoto.name || '照片'}
          className="max-w-full max-h-[90vh] object-contain rounded-lg"
        />
      </div>

      {/* 右箭头 */}
      {photos.length > 1 && (
        <button
          onClick={handleNext}
          className="absolute right-4 text-white text-5xl hover:text-gray-300 z-10"
          title="下一张"
        >
          ›
        </button>
      )}

      {/* 缩略图导航 */}
      {photos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
          {photos.map((photo, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation()
                setCurrentIndex(index)
              }}
              className={`w-16 h-16 rounded-md overflow-hidden border-2 transition-all ${
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
      )}
    </div>
  )
}

export default PhotoViewer
