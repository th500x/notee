/**
 * 应用常量定义
 * 集中管理所有魔法数字和字符串常量
 */

/**
 * 日期相关常量
 */
export const DATE_CONSTANTS = {
  // 最早可访问的日期
  MIN_DATE: new Date(2026, 0, 1), // 2026-01-01
  // 最晚可访问的日期
  MAX_DATE: new Date(2026, 0, 31), // 2026-01-31
}

/**
 * 缓存相关常量
 */
export const CACHE_CONSTANTS = {
  // 缓存时长（毫秒）
  DURATION: 5 * 60 * 1000, // 5分钟
  // 最大缓存项数
  MAX_SIZE: 50,
  // 缓存键前缀
  KEY_PREFIX: {
    ALL_NEWS: 'all_news',
    NEWS_BY_DATE: 'news_',
    HOT_NEWS: 'hot_news',
  }
}

/**
 * API相关常量
 */
export const API_CONSTANTS = {
  // 超时时间（毫秒）
  TIMEOUT: 30000, // 30秒
  // 端点路径
  ENDPOINTS: {
    NEWS: '/news',
    NEWS_BY_DATE: '/news/:date',
    EMOJI: '/emoji',
    HOT_NEWS: '/emoji/hot/ranking',
  }
}

/**
 * UI相关常量
 */
export const UI_CONSTANTS = {
  // 热门新闻显示数量
  HOT_NEWS_LIMIT: 3,
  // 新闻摘要最大长度
  NEWS_SUMMARY_MAX_LENGTH: 200,
  // 加载动画延迟（毫秒）
  LOADING_DELAY: 300,
}

/**
 * Emoji相关常量
 */
export const EMOJI_CONSTANTS = {
  BEER: '🍺',
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  // 有效的emoji列表
  VALID_EMOJIS: ['🍺', '👍', '👎'],
}

/**
 * 新闻分类常量
 */
export const CATEGORY_CONSTANTS = {
  WORLD_POLITICS: 'world_politics',
  WORLD_ECONOMY: 'world_economy',
  ASIA_POLITICS: 'asia_politics',
  ASIA_ECONOMY: 'asia_economy',
  THAILAND_POLITICS: 'thailand_politics',
  THAILAND_SOCIETY: 'thailand_society',
}

/**
 * 日志前缀常量
 */
export const LOG_PREFIX = {
  APP: '[App]',
  NEWS_DATA: '[NewsData]',
  HOT_NEWS: '[HotNews]',
  EMOJI: '[Emoji]',
  CACHE: '[Cache]',
  API: '[API]',
}

/**
 * 分类信息配置
 * 包含每个分类的显示标题和颜色样式
 */
export const CATEGORY_INFO = {
  world_politics: { 
    title: '世界政治新闻', 
    color: 'bg-red-100 text-red-800' 
  },
  world_economy: { 
    title: '世界经济新闻', 
    color: 'bg-blue-100 text-blue-800' 
  },
  asia_politics: { 
    title: '亚洲政治新闻', 
    color: 'bg-yellow-100 text-yellow-800' 
  },
  asia_economy: { 
    title: '亚洲经济新闻', 
    color: 'bg-green-100 text-green-800' 
  },
  thailand_politics: { 
    title: '中泰政治新闻', 
    color: 'bg-purple-100 text-purple-800' 
  },
  thailand_society: { 
    title: '中泰民生新闻', 
    color: 'bg-pink-100 text-pink-800' 
  },
}
