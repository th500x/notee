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
  MAX_DATE: new Date(2026, 5, 30), // 2026-06-30
}

/**
 * 缓存相关常量
 */
export const CACHE_CONSTANTS = {
  DURATION: 5 * 60 * 1000,
  MAX_SIZE: 50,
  KEY_PREFIX: {
    ALL_NEWS: 'all_news',
    NEWS_BY_DATE: 'news_',
  }
}

export const LOG_PREFIX = {
  APP: '[App]',
  NEWS_DATA: '[NewsData]',
}
