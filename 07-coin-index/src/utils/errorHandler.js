/**
 * 错误处理工具
 * 提供统一的错误处理机制
 */

import { config } from '../config'

/**
 * 自定义数据加载错误类
 */
export class DataLoadError extends Error {
  constructor(message, code, details) {
    super(message)
    this.name = 'DataLoadError'
    this.code = code
    this.details = details
  }
}

/**
 * 自定义验证错误类
 */
export class ValidationError extends Error {
  constructor(message, field, value) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
    this.value = value
  }
}

/**
 * 统一的异步操作错误处理
 * @param {Function} fn - 异步函数
 * @param {string} context - 上下文描述
 * @returns {Promise<any>} 函数执行结果
 * @throws {DataLoadError} 执行失败时抛出错误
 */
export async function handleDataLoad(fn, context) {
  try {
    return await fn()
  } catch (error) {
    const errorMsg = `[${context}] 失败: ${error.message}`
    
    if (config.features.enableLogging) {
      console.error(errorMsg, error)
    }
    
    throw new DataLoadError(
      errorMsg,
      'DATA_LOAD_ERROR',
      { originalError: error, context }
    )
  }
}

/**
 * 安全执行函数（捕获错误但不抛出）
 * @param {Function} fn - 要执行的函数
 * @param {any} defaultValue - 出错时的默认返回值
 * @param {string} context - 上下文描述
 * @returns {Promise<any>} 函数执行结果或默认值
 */
export async function safeExecute(fn, defaultValue = null, context = 'Unknown') {
  try {
    return await fn()
  } catch (error) {
    if (config.features.enableLogging) {
      console.warn(`[${context}] 执行失败，返回默认值:`, error.message)
    }
    return defaultValue
  }
}

/**
 * 记录错误日志
 * @param {string} context - 上下文
 * @param {Error} error - 错误对象
 * @param {Object} additionalInfo - 额外信息
 */
export function logError(context, error, additionalInfo = {}) {
  if (!config.features.enableLogging) {
    return
  }
  
  console.error(`[${context}] 错误:`, {
    message: error.message,
    name: error.name,
    stack: error.stack,
    ...additionalInfo
  })
}

/**
 * 记录警告日志
 * @param {string} context - 上下文
 * @param {string} message - 警告消息
 * @param {Object} additionalInfo - 额外信息
 */
export function logWarning(context, message, additionalInfo = {}) {
  if (!config.features.enableLogging) {
    return
  }
  
  console.warn(`[${context}] 警告: ${message}`, additionalInfo)
}

/**
 * 记录调试日志
 * @param {string} context - 上下文
 * @param {string} message - 调试消息
 * @param {Object} data - 数据
 */
export function logDebug(context, message, data = {}) {
  if (!config.features.enableDebug) {
    return
  }
  
  console.log(`[${context}] ${message}`, data)
}
