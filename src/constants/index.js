/**
 * 项目配置
 */
export const PROJECTS = [
  {
    id: '01-news-calendar',
    name: '新聞筆記',
    icon: '📰',
    description: '浏览每日重要新闻，了解世界动态\n支持日历视图',
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
    id: '03-lost-pearls',
    name: '歷史遺珠',
    icon: '📘',
    description: '复杂游戏的攻略与资讯汇总\n纯阅读、无广告',
    gradient: 'linear-gradient(135deg, #0f1419 0%, #6cb6ff 100%)',
    path: '/03-lost-pearls/'
  },
  {
    id: '06-rental-tracking',
    name: '租賃追蹤',
    icon: '🏠',
    description: '房源租赁管理与收支追踪\n支持多项目和详细统计',
    gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    path: '/06-rental-tracking/'
  },
  {
    id: '07-coin-index',
    name: '區塊指標',
    icon: '📈',
    description: '加密货币与宏观情绪周度指标\n仅管理员可见入口',
    gradient: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
    path: '/07-coin-index/',
    /** 主页卡片：须主站管理员登录（页脚登录）后才显示 */
    adminOnly: true
  },
  {
    id: '08-life-resume',
    name: '人生片段',
    icon: '📖',
    description: '按年份记录人生片段\n支持隐私分级与 Google 云盘链接',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    path: '/08-life-resume/'
  }
]

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
