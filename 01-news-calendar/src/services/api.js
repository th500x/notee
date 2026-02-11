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
      return `${protocol}//${hostname}:3001/api`
    }
    // 其他情况（如IP访问）
    return `${protocol}//${hostname}:3001/api`
  }
  // 服务端渲染默认值
  return 'https://notee.vip/api'
}

const API_BASE_URL = getApiBaseUrl()

// API请求封装
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  }
  
  try {
    const response = await fetch(url, config)
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`)
    }
    
    return data
  } catch (error) {
    console.error('API请求失败:', error)
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