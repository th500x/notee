/**
 * 应用常量定义
 * 统一管理所有魔法数字和字符串常量
 * 
 * @module constants
 * @description
 * 集中定义应用中使用的所有常量，包括：
 * - 分页配置
 * - 字体配置
 * - 书籍分类
 * - 存储键名
 * - 密码配置
 * - 日志前缀
 * - PDF配置
 * 
 * @example
 * import { PAGINATION_CONFIG, FONT_OPTIONS, STORAGE_KEYS } from './constants'
 * 
 * // 使用分页配置
 * const pages = splitContent(content, PAGINATION_CONFIG.CHARS_PER_PAGE)
 * 
 * // 使用存储键
 * localStorage.getItem(STORAGE_KEYS.READING_PROGRESS)
 */

// 分页配置
export const PAGINATION_CONFIG = {
  CHARS_PER_PAGE: 1800,           // 每页字符数限制
  MIN_CHARS_FOR_BREAK: 300,       // 最小分页字符数（遇到标题时的最小页面内容）
  HEADING_BREAK_THRESHOLD: 0.5,   // 标题分页阈值（页面容量的50%）
}

// 字体配置
/**
 * 可用字体选项
 * @type {Array<{value: string, label: string, family: string}>}
 */
export const FONT_OPTIONS = [
  { value: 'fangsong', label: '仿宋', family: "'FangSong', 'STFangsong', serif" },
  { value: 'kaiti', label: '楷体', family: "'KaiTi', 'STKaiti', serif" },
  { value: 'heiti', label: '黑体', family: "'SimHei', 'STHeiti', sans-serif" }
]

// 字体大小范围
/**
 * 字体大小配置
 * @type {{MIN: number, MAX: number, DEFAULT: number}}
 */
export const FONT_SIZE_RANGE = {
  MIN: 12,      // 最小字号（px）
  MAX: 24,      // 最大字号（px）
  DEFAULT: 16   // 默认字号（px）
}

// 行高范围
/**
 * 行高配置
 * @type {{MIN: number, MAX: number, DEFAULT: number, STEP: number}}
 */
export const LINE_HEIGHT_RANGE = {
  MIN: 1.2,       // 最小行高
  MAX: 2.5,       // 最大行高
  DEFAULT: 1.8,   // 默认行高
  STEP: 0.1       // 调整步长
}

// 书籍分类
/**
 * 书籍分类常量
 * @type {{ALL: string, GAME_HISTORY: string, GAME_TEXT: string, TRAVEL: string, PERSONAL: string}}
 */
export const BOOK_CATEGORIES = {
  ALL: '全部',
  GAME_HISTORY: '游戏史记',
  GAME_TEXT: '游戏文本',
  TRAVEL: '游记杂谈',
  PERSONAL: '个人私密'
}

// 分类图标
/**
 * 分类对应的emoji图标
 * @type {Object<string, string>}
 */
export const CATEGORY_ICONS = {
  [BOOK_CATEGORIES.ALL]: '📚',
  [BOOK_CATEGORIES.GAME_HISTORY]: '🎮',
  [BOOK_CATEGORIES.GAME_TEXT]: '📖',
  [BOOK_CATEGORIES.TRAVEL]: '✈️',
  [BOOK_CATEGORIES.PERSONAL]: '🔒'
}

// 需要密码保护的分类
/**
 * 需要密码验证的分类列表
 * @type {string[]}
 */
export const PROTECTED_CATEGORIES = [
  BOOK_CATEGORIES.GAME_TEXT,
  BOOK_CATEGORIES.PERSONAL
]

// 存储键名
/**
 * localStorage键名常量
 * @type {{READING_PROGRESS: string, BOOKMARKS: string, ADMIN_TOKEN: string, TOKEN_EXPIRY: string}}
 */
export const STORAGE_KEYS = {
  READING_PROGRESS: 'tale-reading-progress',  // 阅读进度
  BOOKMARKS: 'tale-bookmarks',                // 书签
  ADMIN_TOKEN: 'notee-admin-token',           // 管理员Token（统一认证）
  TOKEN_EXPIRY: 'notee-token-expiry'          // Token过期时间
}

// Token配置
/**
 * Token有效期配置
 * @type {number}
 */
export const TOKEN_DURATION = 30 * 24 * 60 * 60 * 1000  // 30天（毫秒）

// 日志前缀
/**
 * 日志前缀常量，用于统一日志格式
 * @type {{BOOK_CONTEXT: string, BOOK_READER: string, BOOKSHELF: string, PDF_EXPORT: string, AUTH: string}}
 */
export const LOG_PREFIX = {
  BOOK_CONTEXT: '[BookContext]',
  BOOK_READER: '[BookReader]',
  BOOKSHELF: '[Bookshelf]',
  PDF_EXPORT: '[PDF Export]',
  AUTH: '[Auth]'
}

// PDF导出配置
/**
 * PDF导出配置
 * @type {{PAGE_WIDTH: number, PAGE_HEIGHT: number, SCALE: number, QUALITY: number}}
 */
export const PDF_CONFIG = {
  PAGE_WIDTH: 210,    // A4宽度（mm）
  PAGE_HEIGHT: 297,   // A4高度（mm）
  SCALE: 1.5,         // 渲染缩放比例
  QUALITY: 1.0        // JPEG质量（0-1）
}
