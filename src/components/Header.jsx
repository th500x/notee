import { useState } from 'react'

/**
 * 页头组件
 */
export function Header({ onShare }) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">無限筆記</h1>
            <p className="text-gray-600 mt-2">多功能网页应用平台</p>
          </div>
          <div className="flex items-center space-x-4">
            <div 
              className="text-sm text-gray-500 hover:text-blue-600 cursor-pointer transition-colors relative"
              onClick={onShare}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              🍺 LOVE & PEACE!
              {/* 悬停提示 */}
              {showTooltip && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap">
                  分享本站
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
