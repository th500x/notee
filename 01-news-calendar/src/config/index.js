/**
 * 应用配置文件
 * 统一管理所有配置项，包括API、缓存、业务规则等
 */

/**
 * 获取API基础URL
 * 根据当前环境自动选择合适的API地址
 * 
 * @returns {string} API基础URL
 */
function getApiBaseUrl() {
  // 优先使用环境变量
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  
  // 服务端渲染环境
  if (typeof window === 'undefined') {
    return 'https://notee.vip/api'
  }
  
  const { protocol, hostname } = window.location
  
  // 生产环境
  if (hostname === 'notee.vip' || hostname === 'www.notee.vip') {
    return `${protocol}//${hostname}/api`
  }
  
  // 本地开发环境
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3002/api`
  }
  
  // 其他情况（如内网IP）
  return `${protocol}//${hostname}:3002/api`
}

/**
 * 应用配置对象
 */
export const config = {
  // API配置
  api: {
    baseUrl: getApiBaseUrl(),
    timeout: 30000, // 30秒超时
  },
  
  // 缓存配置
  cache: {
    duration: 5 * 60 * 1000, // 5分钟
    maxSize: 50, // 最多缓存50项
  },
  
  // 业务配置
  business: {
    hotNewsLimit: 3, // 热门新闻显示数量
    validEmojis: ['🍺', '👍', '👎'], // 有效的emoji列表
    dateRange: {
      min: new Date(2026, 0, 1), // 2026-01-01
      max: new Date(2026, 0, 31), // 2026-01-31
    }
  },
  
  // 功能开关
  features: {
    enableCache: true, // 是否启用缓存
    enableLogging: import.meta.env.DEV, // 开发环境启用日志
  }
}

/**
 * 新闻分类枚举
 */
export const NEWS_CATEGORIES = {
  WORLD_POLITICS: 'world_politics',
  WORLD_ECONOMY: 'world_economy',
  ASIA_POLITICS: 'asia_politics',
  ASIA_ECONOMY: 'asia_economy',
  THAILAND_POLITICS: 'thailand_politics',
  THAILAND_SOCIETY: 'thailand_society',
}

/**
 * 分类信息配置
 * 包含每个分类的显示标题和颜色样式
 */
export const CATEGORY_INFO = {
  [NEWS_CATEGORIES.WORLD_POLITICS]: { 
    title: '世界政治新闻', 
    color: 'bg-red-100 text-red-800' 
  },
  [NEWS_CATEGORIES.WORLD_ECONOMY]: { 
    title: '世界经济新闻', 
    color: 'bg-blue-100 text-blue-800' 
  },
  [NEWS_CATEGORIES.ASIA_POLITICS]: { 
    title: '亚洲政治新闻', 
    color: 'bg-yellow-100 text-yellow-800' 
  },
  [NEWS_CATEGORIES.ASIA_ECONOMY]: { 
    title: '亚洲经济新闻', 
    color: 'bg-green-100 text-green-800' 
  },
  [NEWS_CATEGORIES.THAILAND_POLITICS]: { 
    title: '中泰政治新闻', 
    color: 'bg-purple-100 text-purple-800' 
  },
  [NEWS_CATEGORIES.THAILAND_SOCIETY]: { 
    title: '中泰民生新闻', 
    color: 'bg-pink-100 text-pink-800' 
  },
}

/**
 * Emoji配置
 */
export const EMOJIS = {
  BEER: '🍺',
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
}

/**
 * 限制配置
 */
export const LIMITS = {
  HOT_NEWS: 3, // 热门新闻数量
  NEWS_SUMMARY_LENGTH: 200, // 新闻摘要最大长度
}
