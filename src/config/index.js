/**
 * 获取留言板API基础URL
 */
function getGuestbookApiUrl() {
  if (typeof window === 'undefined') {
    return '/api/guestbook'
  }
  
  const { protocol, hostname } = window.location
  
  // 生产环境
  if (hostname === 'notee.vip' || hostname === 'www.notee.vip') {
    return `${protocol}//${hostname}/api/guestbook`
  }
  
  // 本地开发
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/api/guestbook'
  }
  
  // 其他情况
  return `${protocol}//${hostname}/api/guestbook`
}

/**
 * 获取全局认证API基础URL
 */
function getAuthApiUrl() {
  if (typeof window === 'undefined') {
    return '/api/auth'
  }
  
  const { protocol, hostname } = window.location
  
  // 生产环境
  if (hostname === 'notee.vip' || hostname === 'www.notee.vip') {
    return `${protocol}//${hostname}/api/auth`
  }
  
  // 本地开发
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/api/auth'
  }
  
  // 其他情况
  return `${protocol}//${hostname}/api/auth`
}

/**
 * 应用配置
 */
export const config = {
  // API配置
  api: {
    guestbook: getGuestbookApiUrl(),
    auth: getAuthApiUrl(),
    timeout: 30000
  },
  
  // 缓存配置
  cache: {
    duration: 5 * 60 * 1000, // 5分钟
    maxSize: 50
  },
  
  // 留言板配置
  guestbook: {
    maxMessageLength: 50,
    messagesPerPage: 20
  },
  
  // 功能开关
  features: {
    enableCache: true,
    enableLogging: import.meta.env.DEV
  }
}
