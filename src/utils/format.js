/**
 * 格式化时间戳为本地时间字符串
 * @param {string|number|Date} timestamp - 时间戳
 * @returns {string} 格式化后的时间字符串
 */
export function formatTimestamp(timestamp) {
  try {
    const date = new Date(timestamp)
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return '无效时间'
    }
    
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    console.error('[Format] 格式化时间失败:', error)
    return '无效时间'
  }
}

/**
 * 格式化IP地址和位置信息
 * @param {string} ip - IP地址
 * @param {Object} location - 位置信息
 * @returns {string} 格式化后的显示文本
 */
export function formatLocation(ip, location) {
  // 处理本地IP
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
    return '本地'
  }
  
  // 有地理位置信息
  if (location && location.city) {
    if (location.city === '本地') {
      return '本地'
    }
    return location.city
  }
  
  // 没有地理位置信息
  return 'IP用户'
}

/**
 * HTML转义，防止XSS
 * @param {string} text - 要转义的文本
 * @returns {string} 转义后的文本
 */
export function escapeHtml(text) {
  if (!text) return ''
  
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 截断文本
 * @param {string} text - 要截断的文本
 * @param {number} maxLength - 最大长度
 * @param {string} suffix - 后缀，默认'...'
 * @returns {string} 截断后的文本
 */
export function truncateText(text, maxLength, suffix = '...') {
  if (!text || text.length <= maxLength) {
    return text
  }
  
  return text.substring(0, maxLength) + suffix
}
