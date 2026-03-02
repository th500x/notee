import { useState, useEffect } from 'react'
import { performanceMonitor } from '../utils/performance'

/**
 * 性能监控面板（仅开发环境）
 * 显示实时性能指标和缓存统计
 */
export function PerformancePanel({ cache }) {
  const [isOpen, setIsOpen] = useState(false)
  const [stats, setStats] = useState({})
  const [cacheStats, setCacheStats] = useState({})
  
  useEffect(() => {
    if (!isOpen) return
    
    const interval = setInterval(() => {
      setStats(performanceMonitor.getSummary())
      if (cache) {
        setCacheStats(cache.getStats())
      }
    }, 1000)
    
    return () => clearInterval(interval)
  }, [isOpen, cache])
  
  if (!import.meta.env.DEV) {
    return null
  }
  
  return (
    <>
      {/* 切换按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors z-50"
        title="性能监控"
      >
        📊 {isOpen ? '关闭' : '性能'}
      </button>
      
      {/* 监控面板 */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 bg-white rounded-lg shadow-2xl p-4 w-96 max-h-96 overflow-y-auto z-50 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">性能监控</h3>
            <button
              onClick={() => performanceMonitor.clear()}
              className="text-xs text-red-600 hover:text-red-700"
            >
              清除数据
            </button>
          </div>
          
          {/* 缓存统计 */}
          {cache && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-bold text-blue-900 mb-2">缓存统计</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-600">命中率:</span>
                  <span className="ml-2 font-bold text-blue-600">{cacheStats.hitRate}</span>
                </div>
                <div>
                  <span className="text-gray-600">大小:</span>
                  <span className="ml-2 font-bold">{cacheStats.size}/{cacheStats.maxSize}</span>
                </div>
                <div>
                  <span className="text-gray-600">命中:</span>
                  <span className="ml-2 font-bold text-green-600">{cacheStats.hits}</span>
                </div>
                <div>
                  <span className="text-gray-600">未命中:</span>
                  <span className="ml-2 font-bold text-orange-600">{cacheStats.misses}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* API性能统计 */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-gray-900">API性能</h4>
            {Object.keys(stats).length === 0 ? (
              <p className="text-xs text-gray-500">暂无数据</p>
            ) : (
              Object.entries(stats).map(([name, stat]) => (
                <div key={name} className="p-2 bg-gray-50 rounded text-xs">
                  <div className="font-bold text-gray-900 mb-1">{name}</div>
                  <div className="grid grid-cols-4 gap-1 text-gray-600">
                    <div>
                      <div className="text-gray-500">次数</div>
                      <div className="font-bold">{stat.count}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">平均</div>
                      <div className="font-bold text-blue-600">{stat.avg}ms</div>
                    </div>
                    <div>
                      <div className="text-gray-500">最小</div>
                      <div className="font-bold text-green-600">{stat.min}ms</div>
                    </div>
                    <div>
                      <div className="text-gray-500">最大</div>
                      <div className="font-bold text-red-600">{stat.max}ms</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* 导出按钮 */}
          <button
            onClick={() => {
              const data = performanceMonitor.export()
              const blob = new Blob([data], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `performance-${Date.now()}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="mt-4 w-full bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs py-2 rounded transition-colors"
          >
            导出数据
          </button>
        </div>
      )}
    </>
  )
}
