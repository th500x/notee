/**
 * 应用错误类
 */
export class AppError extends Error {
  /**
   * @param {string} message - 错误消息
   * @param {string} code - 错误代码
   * @param {any} details - 错误详情
   */
  constructor(message, code, details) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }
}

/**
 * 处理异步操作，返回[error, data]元组
 * @param {Promise} promise - 异步操作
 * @param {string} context - 上下文信息，用于日志
 * @returns {Promise<[Error|null, any]>} [错误, 数据]
 * 
 * @example
 * const [error, data] = await handleAsync(fetchData(), 'FetchData')
 * if (error) {
 *   // 处理错误
 * }
 */
export async function handleAsync(promise, context) {
  try {
    const data = await promise
    return [null, data]
  } catch (error) {
    console.error(`[${context}] 错误:`, error)
    return [error, null]
  }
}

/**
 * 日志工具
 */
export const logger = {
  /**
   * 信息日志
   */
  info: (context, message, data) => {
    if (import.meta.env.DEV) {
      console.log(`[${context}] ${message}`, data || '')
    }
  },
  
  /**
   * 错误日志
   */
  error: (context, message, error) => {
    console.error(`[${context}] ${message}`, error)
  },
  
  /**
   * 警告日志
   */
  warn: (context, message, data) => {
    console.warn(`[${context}] ${message}`, data || '')
  }
}

/**
 * 错误代码常量
 */
export const ERROR_CODES = {
  // 网络错误
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  
  // API错误
  API_ERROR: 'API_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  
  // 验证错误
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // 业务错误
  CREATE_ERROR: 'CREATE_ERROR',
  DELETE_ERROR: 'DELETE_ERROR',
  LOGIN_ERROR: 'LOGIN_ERROR',
  LOAD_ERROR: 'LOAD_ERROR'
}

/**
 * 获取用户友好的错误消息
 * @param {Error} error - 错误对象
 * @returns {string} 用户友好的错误消息
 */
export function getUserFriendlyMessage(error) {
  if (error instanceof AppError) {
    return error.message
  }
  
  // 网络错误
  if (error.message && (error.message.includes('fetch') || error.message.includes('network'))) {
    return '网络连接失败，请检查网络后重试'
  }
  
  // 超时错误
  if (error.message && error.message.includes('timeout')) {
    return '请求超时，请稍后重试'
  }
  
  // 默认错误消息
  return '操作失败，请稍后重试'
}
