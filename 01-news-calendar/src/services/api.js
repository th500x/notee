import { API_CONSTANTS, LOG_PREFIX } from '../constants'

// 根据环境自动选择API地址
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    // 如果是生产环境（notee.vip），使用相对路径
    if (hostname === 'notee.vip' || hostname === 'www.notee.vip') {
      return `${protocol}//${hostname}/api`
    }
    // 本地开发环境
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:3002/api`
    }
    // 其他情况（如IP访问）
    return `${protocol}//${hostname}:3002/api`
  }
  // 服务端渲染默认值
  return 'https://notee.vip/api'
}

const API_BASE_URL = getApiBaseUrl()

// 存储活跃的请求控制器，用于取消请求
const activeRequests = new Map()

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3, // 最大重试次数
  retryDelay: 1000, // 初始重试延迟（毫秒）
  retryableStatuses: [408, 500, 502, 503, 504], // 可重试的HTTP状态码（429 限流不重试，避免放大请求）
}

/**
 * 取消指定端点的所有活跃请求
 * @param {string} endpoint - API端点
 */
export function cancelRequest(endpoint) {
  const controller = activeRequests.get(endpoint)
  if (controller) {
    controller.abort()
    activeRequests.delete(endpoint)
  }
}

/**
 * 取消所有活跃请求
 */
export function cancelAllRequests() {
  activeRequests.forEach(controller => controller.abort())
  activeRequests.clear()
}

/**
 * 延迟函数（用于重试）
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 判断错误是否可重试
 * @param {Error} error - 错误对象
 * @param {number} status - HTTP状态码
 * @returns {boolean}
 */
function isRetryableError(error, status) {
  // 网络错误可重试
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true
  }
  
  // 特定HTTP状态码可重试
  if (status && RETRY_CONFIG.retryableStatuses.includes(status)) {
    return true
  }
  
  return false
}

/**
 * API请求封装（带超时、取消和重试机制）
 * @param {string} endpoint - API端点
 * @param {Object} options - fetch选项
 * @param {number} timeout - 超时时间（毫秒），默认30秒
 * @param {number} retryCount - 当前重试次数（内部使用）
 * @returns {Promise<Object>} API响应
 */
async function apiRequest(endpoint, options = {}, timeout = API_CONSTANTS.TIMEOUT, retryCount = 0) {
  const url = `${API_BASE_URL}${endpoint}`
  
  // 创建AbortController用于超时和取消
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  // 存储控制器，用于外部取消
  activeRequests.set(endpoint, controller)
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    signal: controller.signal,
    ...options
  }
  
  try {
    const response = await fetch(url, config)
    clearTimeout(timeoutId)
    activeRequests.delete(endpoint)
    
    const data = await response.json()
    
    if (!response.ok) {
      // 检查是否可重试
      if (retryCount < RETRY_CONFIG.maxRetries && isRetryableError(new Error(data.error), response.status)) {
        const retryDelay = RETRY_CONFIG.retryDelay * Math.pow(2, retryCount) // 指数退避
        console.warn(`${LOG_PREFIX.API} ${endpoint} 请求失败，${retryDelay}ms后重试 (${retryCount + 1}/${RETRY_CONFIG.maxRetries})`)
        await delay(retryDelay)
        return apiRequest(endpoint, options, timeout, retryCount + 1)
      }
      
      throw new Error(data.error || `HTTP error! status: ${response.status}`)
    }
    
    return data
  } catch (error) {
    clearTimeout(timeoutId)
    activeRequests.delete(endpoint)
    
    // 处理不同类型的错误
    if (error.name === 'AbortError') {
      throw new Error('请求超时或已取消，请检查网络连接')
    }
    
    // 网络错误重试
    if (retryCount < RETRY_CONFIG.maxRetries && isRetryableError(error)) {
      const retryDelay = RETRY_CONFIG.retryDelay * Math.pow(2, retryCount) // 指数退避
      console.warn(`${LOG_PREFIX.API} ${endpoint} 网络错误，${retryDelay}ms后重试 (${retryCount + 1}/${RETRY_CONFIG.maxRetries})`)
      await delay(retryDelay)
      return apiRequest(endpoint, options, timeout, retryCount + 1)
    }
    
    console.error(`${LOG_PREFIX.API} ${endpoint} 请求失败:`, error)
    throw error
  }
}

// 新闻相关API
export const newsAPI = {
  getAllNews: () => apiRequest('/news'),
  getNewsByDate: (date) => apiRequest(`/news/${date}`)
}

// Emoji反应相关API
export const emojiAPI = {
  getReactions: (newsId) => apiRequest(`/emoji/${encodeURIComponent(newsId)}`),
  getUserReaction: (newsId) => apiRequest(`/emoji/${encodeURIComponent(newsId)}/user`),
  addReaction: (newsId, emoji) => apiRequest('/emoji', {
    method: 'POST',
    body: JSON.stringify({ newsId, emoji })
  }),
  deleteReaction: (newsId) => apiRequest(`/emoji/${encodeURIComponent(newsId)}`, {
    method: 'DELETE'
  })
}

// 健康检查
export const healthCheck = () => apiRequest('/health')