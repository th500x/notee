/**
 * 防抖函数
 * 在事件被触发n秒后再执行回调，如果在这n秒内又被触发，则重新计时
 * 
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 * 
 * @example
 * const debouncedSearch = debounce((query) => {
 *   console.log('搜索:', query)
 * }, 300)
 * 
 * // 用户输入时调用
 * input.addEventListener('input', (e) => {
 *   debouncedSearch(e.target.value)
 * })
 */
export function debounce(func, wait) {
  let timeout
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * 节流函数
 * 规定在一个单位时间内，只能触发一次函数。如果这个单位时间内触发多次函数，只有一次生效
 * 
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} 节流后的函数
 * 
 * @example
 * const throttledScroll = throttle(() => {
 *   console.log('滚动事件')
 * }, 1000)
 * 
 * window.addEventListener('scroll', throttledScroll)
 */
export function throttle(func, limit) {
  let inThrottle
  
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}
