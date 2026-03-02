/**
 * 性能监控工具
 * 用于测量和记录应用性能指标
 */

/**
 * 性能监控器
 */
export const performanceMonitor = {
  /**
   * 测量同步函数执行时间
   * @param {string} name - 操作名称
   * @param {Function} fn - 要测量的函数
   * @returns {any} 函数返回值
   * 
   * @example
   * const result = performanceMonitor.measure('processData', () => {
   *   return processData(data)
   * })
   */
  measure: (name, fn) => {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    const duration = end - start
    
    performanceMonitor.log(name, duration)
    
    return result
  },
  
  /**
   * 测量异步函数执行时间
   * @param {string} name - 操作名称
   * @param {Function} fn - 要测量的异步函数
   * @returns {Promise<any>} 函数返回值
   * 
   * @example
   * const data = await performanceMonitor.measureAsync('fetchData', async () => {
   *   return await fetch('/api/data')
   * })
   */
  measureAsync: async (name, fn) => {
    const start = performance.now()
    const result = await fn()
    const end = performance.now()
    const duration = end - start
    
    performanceMonitor.log(name, duration)
    
    return result
  },
  
  /**
   * 记录性能数据
   * @param {string} name - 操作名称
   * @param {number} duration - 持续时间（毫秒）
   */
  log: (name, duration) => {
    // 开发环境：输出到控制台
    if (import.meta.env.DEV) {
      const color = duration < 100 ? 'green' : duration < 500 ? 'orange' : 'red'
      console.log(
        `%c[Performance] ${name}: ${duration.toFixed(2)}ms`,
        `color: ${color}; font-weight: bold`
      )
    }
    
    // 记录到性能指标
    performanceMonitor.metrics.push({
      name,
      duration,
      timestamp: Date.now()
    })
    
    // 限制指标数量（最多保留100条）
    if (performanceMonitor.metrics.length > 100) {
      performanceMonitor.metrics.shift()
    }
  },
  
  /**
   * 性能指标存储
   */
  metrics: [],
  
  /**
   * 获取性能统计
   * @param {string} [name] - 操作名称，不传则返回所有操作的统计
   * @returns {Object} 统计信息
   * 
   * @example
   * // 获取特定操作的统计
   * const stats = performanceMonitor.getStats('fetchData')
   * console.log(`平均耗时: ${stats.avg}ms`)
   * 
   * // 获取所有操作的统计
   * const allStats = performanceMonitor.getStats()
   */
  getStats: (name) => {
    const filtered = name
      ? performanceMonitor.metrics.filter(m => m.name === name)
      : performanceMonitor.metrics
    
    if (filtered.length === 0) {
      return {
        count: 0,
        avg: 0,
        min: 0,
        max: 0,
        total: 0
      }
    }
    
    const durations = filtered.map(m => m.duration)
    const total = durations.reduce((sum, d) => sum + d, 0)
    const avg = total / durations.length
    const min = Math.min(...durations)
    const max = Math.max(...durations)
    
    return {
      count: filtered.length,
      avg: parseFloat(avg.toFixed(2)),
      min: parseFloat(min.toFixed(2)),
      max: parseFloat(max.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    }
  },
  
  /**
   * 获取所有操作的统计摘要
   * @returns {Object} 按操作名称分组的统计信息
   * 
   * @example
   * const summary = performanceMonitor.getSummary()
   * console.table(summary)
   */
  getSummary: () => {
    const names = [...new Set(performanceMonitor.metrics.map(m => m.name))]
    const summary = {}
    
    names.forEach(name => {
      summary[name] = performanceMonitor.getStats(name)
    })
    
    return summary
  },
  
  /**
   * 清除所有性能指标
   */
  clear: () => {
    performanceMonitor.metrics = []
  },
  
  /**
   * 导出性能数据（用于分析）
   * @returns {string} JSON格式的性能数据
   */
  export: () => {
    return JSON.stringify({
      metrics: performanceMonitor.metrics,
      summary: performanceMonitor.getSummary(),
      exportTime: new Date().toISOString()
    }, null, 2)
  }
}

/**
 * React组件性能监控Hook
 * @param {string} componentName - 组件名称
 * @returns {Function} 测量函数
 * 
 * @example
 * function MyComponent() {
 *   const measure = usePerformance('MyComponent')
 *   
 *   useEffect(() => {
 *     measure('loadData', async () => {
 *       await loadData()
 *     })
 *   }, [])
 * }
 */
export function usePerformance(componentName) {
  return (operationName, fn) => {
    const fullName = `${componentName}.${operationName}`
    
    if (fn.constructor.name === 'AsyncFunction') {
      return performanceMonitor.measureAsync(fullName, fn)
    } else {
      return performanceMonitor.measure(fullName, fn)
    }
  }
}

/**
 * 页面加载性能监控
 * 自动记录页面加载相关的性能指标
 */
export function monitorPageLoad() {
  if (typeof window === 'undefined' || !window.performance) {
    return
  }
  
  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = window.performance.timing
      const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart
      const domReadyTime = perfData.domContentLoadedEventEnd - perfData.navigationStart
      const dnsTime = perfData.domainLookupEnd - perfData.domainLookupStart
      const tcpTime = perfData.connectEnd - perfData.connectStart
      const requestTime = perfData.responseEnd - perfData.requestStart
      const renderTime = perfData.domComplete - perfData.domLoading
      
      console.group('%c📊 页面加载性能', 'color: blue; font-weight: bold')
      console.log(`总加载时间: ${pageLoadTime}ms`)
      console.log(`DOM就绪时间: ${domReadyTime}ms`)
      console.log(`DNS查询时间: ${dnsTime}ms`)
      console.log(`TCP连接时间: ${tcpTime}ms`)
      console.log(`请求响应时间: ${requestTime}ms`)
      console.log(`页面渲染时间: ${renderTime}ms`)
      console.groupEnd()
      
      // 记录到性能指标
      performanceMonitor.log('pageLoad', pageLoadTime)
      performanceMonitor.log('domReady', domReadyTime)
      performanceMonitor.log('render', renderTime)
    }, 0)
  })
}

// 自动监控页面加载（仅在浏览器环境）
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  monitorPageLoad()
}
