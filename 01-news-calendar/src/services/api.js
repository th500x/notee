import { API_CONSTANTS } from '../constants'

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
 * API请求封装（带超时和取消机制）
 * @param {string} endpoint - API端点
 * @param {Object} options - fetch选项
 * @param {number} timeout - 超时时间（毫秒），默认30秒
 * @returns {Promise<Object>} API响应
 */
async function apiRequest(endpoint, options = {}, timeout = API_CONSTANTS.TIMEOUT) {
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
    
    console.error(`${endpoint} API请求失败:`, error)
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