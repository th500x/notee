// 根据环境自动选择API地址
const getApiBaseUrl = () => {
  // 临时解决方案：直接使用3001端口
  return 'http://47.113.185.170:3001/api'
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
  // 获取所有新闻
  getAllNews: () => apiRequest('/news'),
  
  // 获取特定日期的新闻
  getNewsByDate: (date) => apiRequest(`/news/${date}`)
}

// Emoji反应相关API
export const emojiAPI = {
  // 获取emoji反应统计
  getReactions: (newsId) => apiRequest(`/emoji/${encodeURIComponent(newsId)}`),
  
  // 获取用户反应
  getUserReaction: (newsId) => apiRequest(`/emoji/${encodeURIComponent(newsId)}/user`),
  
  // 添加或更新emoji反应
  addReaction: (newsId, emoji) => apiRequest('/emoji', {
    method: 'POST',
    body: JSON.stringify({ newsId, emoji })
  }),
  
  // 删除emoji反应
  deleteReaction: (newsId) => apiRequest(`/emoji/${encodeURIComponent(newsId)}`, {
    method: 'DELETE'
  })
}

// 健康检查
export const healthCheck = () => apiRequest('/health')