/**
 * 留言板模块常量
 */
export const MODULES = {
  GENERAL: 'general',
  NEWS: '01-news-calendar',
  TALE: '02-tale-historical',
  COIN: '04-coin-index',
  SAN: '05-san-storm'
}

/**
 * 模块显示名称
 */
export const MODULE_NAMES = {
  [MODULES.GENERAL]: '綜合留言',
  [MODULES.NEWS]: '新聞筆記',
  [MODULES.TALE]: '佚事雜錄',
  [MODULES.COIN]: '區塊指標',
  [MODULES.SAN]: '真三風雲'
}

/**
 * 模块简称（用于筛选显示）
 */
export const MODULE_SHORT_NAMES = {
  all: '全部',
  [MODULES.GENERAL]: '綜合',
  [MODULES.NEWS]: '新聞',
  [MODULES.TALE]: '佚事',
  [MODULES.COIN]: '區塊',
  [MODULES.SAN]: '真三'
}

/**
 * 项目配置
 */
export const PROJECTS = [
  {
    id: '05-san-storm',
    name: '真三風雲',
    icon: '⚔️',
    description: '三国策略战棋游戏\nS1赛季 - 黄巾之乱',
    gradient: 'linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%)',
    path: '/05-san-storm/'
  },
  {
    id: '01-news-calendar',
    name: '新聞筆記',
    icon: '📰',
    description: '浏览每日重要新闻，了解世界动态\n支持日历视图和热门新闻排行',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    path: '/01-news-calendar/'
  },
  {
    id: '02-tale-historical',
    name: '佚事雜錄',
    icon: '📚',
    description: '游戏人生的点滴记录\n支持阅读进度记忆和PDF导出',
    gradient: 'linear-gradient(135deg, #8B4513 0%, #D2691E 100%)',
    path: '/02-tale-historical/'
  },
  {
    id: 'page3',
    name: '功能三',
    icon: '⚡',
    description: '敬请期待...\n更多精彩功能即将上线',
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    path: null,
    comingSoon: true
  },
  {
    id: '06-rental-tracking',
    name: '租賃追蹤',
    icon: '🏠',
    description: '房源租赁管理与收支追踪\n支持多项目和详细统计',
    gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    path: '/06-rental-tracking/'
  }
]

/**
 * 留言板配置
 */
export const GUESTBOOK_CONFIG = {
  MAX_MESSAGE_LENGTH: 50,
  MESSAGES_PER_PAGE: 20,
  CACHE_DURATION: 5 * 60 * 1000 // 5分钟
}

/**
 * 通知类型
 */
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning'
}

/**
 * 本地存储键名
 */
export const STORAGE_KEYS = {
  ADMIN_TOKEN: 'notee-admin-token',
  TOKEN_EXPIRY: 'notee-token-expiry'
}

/**
 * Token有效期（30天）
 * 前后端统一使用此配置
 */
export const TOKEN_DURATION = 30 * 24 * 60 * 60 * 1000
