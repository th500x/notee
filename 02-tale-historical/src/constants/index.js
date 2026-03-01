/**
 * 应用常量定义
 * 统一管理所有魔法数字和字符串常量
 */

// 分页配置
export const PAGINATION_CONFIG = {
  CHARS_PER_PAGE: 1800,           // 每页字符数限制
  MIN_CHARS_FOR_BREAK: 300,       // 最小分页字符数
  HEADING_BREAK_THRESHOLD: 0.5,   // 标题分页阈值（页面容量的50%）
}

// 字体配置
export const FONT_OPTIONS = [
  { value: 'fangsong', label: '仿宋', family: "'FangSong', 'STFangsong', serif" },
  { value: 'kaiti', label: '楷体', family: "'KaiTi', 'STKaiti', serif" },
  { value: 'heiti', label: '黑体', family: "'SimHei', 'STHeiti', sans-serif" }
]

// 字体大小范围
export const FONT_SIZE_RANGE = {
  MIN: 12,
  MAX: 24,
  DEFAULT: 16
}

// 行高范围
export const LINE_HEIGHT_RANGE = {
  MIN: 1.2,
  MAX: 2.5,
  DEFAULT: 1.8,
  STEP: 0.1
}

// 书籍分类
export const BOOK_CATEGORIES = {
  ALL: '全部',
  GAME_HISTORY: '游戏史记',
  GAME_TEXT: '游戏文本',
  TRAVEL: '游记杂谈',
  PERSONAL: '个人私密'
}

// 分类图标
export const CATEGORY_ICONS = {
  [BOOK_CATEGORIES.ALL]: '📚',
  [BOOK_CATEGORIES.GAME_HISTORY]: '🎮',
  [BOOK_CATEGORIES.GAME_TEXT]: '📖',
  [BOOK_CATEGORIES.TRAVEL]: '✈️',
  [BOOK_CATEGORIES.PERSONAL]: '🔒'
}

// 需要密码保护的分类
export const PROTECTED_CATEGORIES = [
  BOOK_CATEGORIES.GAME_TEXT,
  BOOK_CATEGORIES.PERSONAL
]

// 存储键名
export const STORAGE_KEYS = {
  READING_PROGRESS: 'tale-reading-progress',
  BOOKMARKS: 'tale-bookmarks',
  PASSWORD_ATTEMPT: 'pwd_attempt_'
}

// 密码尝试限制配置
export const PASSWORD_ATTEMPT_CONFIG = {
  MAX_ATTEMPTS: 5,                    // 最大尝试次数
  LOCKOUT_DURATION: 10 * 60 * 1000,   // 锁定时长（10分钟）
  LOCKOUT_DURATION_MINUTES: 10        // 锁定时长（分钟）
}

// 日志前缀
export const LOG_PREFIX = {
  BOOK_CONTEXT: '[BookContext]',
  BOOK_READER: '[BookReader]',
  BOOKSHELF: '[Bookshelf]',
  PDF_EXPORT: '[PDF Export]',
  PASSWORD: '[Password]'
}

// PDF导出配置
export const PDF_CONFIG = {
  PAGE_WIDTH: 210,    // A4宽度（mm）
  PAGE_HEIGHT: 297,   // A4高度（mm）
  SCALE: 1.5,         // 渲染缩放比例
  QUALITY: 1.0        // JPEG质量
}
