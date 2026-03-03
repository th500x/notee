/**
 * 应用配置文件
 * 统一管理所有配置项，包括API、OSS、业务规则等
 */

/**
 * 获取API基础URL
 * 根据当前环境自动选择合适的API地址
 * 
 * @returns {string} API基础URL
 */
function getApiBaseUrl() {
  // 优先使用环境变量
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // 生产环境：空字符串，直接使用根路径
  // 因为 Nginx 已经配置了 /api/rental-tracking/ 代理
  if (import.meta.env.PROD) {
    return ''
  }
  
  // 本地开发环境
  return 'http://localhost:3003'
}

/**
 * 获取上传API基础URL
 * 
 * @returns {string} 上传API基础URL
 */
function getUploadApiBaseUrl() {
  // 优先使用环境变量
  if (import.meta.env.VITE_UPLOAD_API_URL) {
    return import.meta.env.VITE_UPLOAD_API_URL
  }
  
  // 生产环境：空字符串，直接使用根路径
  if (import.meta.env.PROD) {
    return ''
  }
  
  // 本地开发环境
  return 'http://localhost:3003'
}

/**
 * 应用配置对象
 */
export const config = {
  // API配置
  api: {
    baseUrl: getApiBaseUrl(),
    uploadBaseUrl: getUploadApiBaseUrl(),
    prefix: '/api/rental-tracking',
    uploadPrefix: '/api/upload',
    timeout: 30000, // 30秒超时
  },
  
  // OSS配置
  oss: {
    region: import.meta.env.VITE_OSS_REGION || 'oss-ap-southeast-1',
    bucket: import.meta.env.VITE_OSS_BUCKET || 'notee-rental',
    maxFileSize: 2 * 1024 * 1024, // 2MB
    maxPhotosPerRecord: 3, // 每条记录最多3张照片
    allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'], // 允许的文件类型
  },
  
  // 业务配置
  business: {
    maxPropertiesPerProject: 100, // 每个项目最多100个房源
    maxRecordsPerProperty: 1000, // 每个房源最多1000条记录
    maxExpensesPerProject: 500, // 每个项目最多500条开支
    maxProjectNameLength: 100, // 项目名称最大长度
    maxPropertyNameLength: 50, // 房源名称最大长度
    maxDescriptionLength: 500, // 描述最大长度
  },
  
  // 密码配置
  password: {
    maxAttempts: 5, // 最大尝试次数
    lockoutDuration: 10 * 60 * 1000, // 锁定时长（10分钟）
    minLength: 6, // 最小密码长度
  },
  
  // Token配置
  token: {
    duration: 30 * 24 * 60 * 60 * 1000, // 30天
    storageKey: 'notee-admin-token',
    expiryKey: 'notee-token-expiry',
  },
  
  // 功能开关
  features: {
    enableLogging: import.meta.env.DEV, // 开发环境启用日志
    enableDebug: import.meta.env.DEV, // 开发环境启用调试
  },
  
  // UI配置
  ui: {
    notificationDuration: 3000, // 通知显示时长（3秒）
    debounceDelay: 300, // 防抖延迟（300ms）
    animationDuration: 200, // 动画时长（200ms）
  }
}

/**
 * 房源状态枚举
 */
export const PROPERTY_STATUS = {
  VACANT: 'vacant',
  RENTED: 'rented',
  NEW_CONTRACT: 'new-contract',
}

/**
 * 房源状态信息配置
 */
export const PROPERTY_STATUS_INFO = {
  [PROPERTY_STATUS.VACANT]: {
    label: '空置中',
    color: 'bg-gray-100 text-gray-800',
    badge: 'bg-gray-500',
  },
  [PROPERTY_STATUS.RENTED]: {
    label: '出租中',
    color: 'bg-green-100 text-green-800',
    badge: 'bg-green-500',
  },
  [PROPERTY_STATUS.NEW_CONTRACT]: {
    label: '新合同',
    color: 'bg-blue-100 text-blue-800',
    badge: 'bg-blue-500',
  },
}

/**
 * 缴租状态枚举
 */
export const PAYMENT_STATUS = {
  PAID: 'paid',
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
}

/**
 * 缴租状态信息配置
 */
export const PAYMENT_STATUS_INFO = {
  [PAYMENT_STATUS.PAID]: {
    label: '已缴租',
    color: 'text-green-600',
    icon: '✓',
  },
  [PAYMENT_STATUS.UNPAID]: {
    label: '未缴租',
    color: 'text-red-600',
    icon: '✗',
  },
  [PAYMENT_STATUS.PARTIAL]: {
    label: '部分缴租',
    color: 'text-yellow-600',
    icon: '◐',
  },
}

/**
 * 月份名称（中文）
 */
export const MONTH_NAMES = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月'
]

/**
 * 月份名称（英文简写）
 */
export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

/**
 * 限制配置
 */
export const LIMITS = {
  MAX_PHOTOS_PER_RECORD: 3, // 每条记录最多3张照片
  MAX_PHOTO_SIZE: 2 * 1024 * 1024, // 2MB
  MAX_PROPERTIES_PER_PROJECT: 100, // 每个项目最多100个房源
  MAX_RECORDS_PER_PROPERTY: 1000, // 每个房源最多1000条记录
  MAX_EXPENSES_PER_PROJECT: 500, // 每个项目最多500条开支
}

/**
 * 超时配置
 */
export const TIMEOUTS = {
  API_TIMEOUT: 30000, // API请求超时（30秒）
  DEBOUNCE_DELAY: 300, // 防抖延迟（300ms）
  NOTIFICATION_DURATION: 3000, // 通知显示时长（3秒）
  ANIMATION_DURATION: 200, // 动画时长（200ms）
}

/**
 * 存储键名
 */
export const STORAGE_KEYS = {
  ADMIN_TOKEN: 'notee-admin-token',
  TOKEN_EXPIRY: 'notee-token-expiry',
  PROJECT_PASSWORDS: 'notee-project-passwords',
  PASSWORD_ATTEMPTS: 'notee-password-attempts',
}

/**
 * API端点
 */
export const API_ENDPOINTS = {
  // 项目相关
  PROJECTS: '/projects',
  PROJECT_BY_ID: (id) => `/projects/${id}`,
  
  // 认证相关
  AUTH_LOGIN: '/auth/login',
  AUTH_VERIFY: '/auth/verify',
  
  // 上传相关
  UPLOAD_PHOTOS: '/photos',
  DELETE_PHOTO: (id) => `/photos/${id}`,
}

