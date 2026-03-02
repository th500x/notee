/**
 * 统一API服务层
 * 提供认证相关的API调用
 * 
 * @module services/api
 */

import { AppError, logger } from '../utils/errorHandler'
import { tokenManager } from '../utils/tokenManager'

// API配置
const API_BASE_URL = 'http://localhost:3001/api'
const API_TIMEOUT = 30000 // 30秒超时

/**
 * 带超时的fetch请求
 * @param {string} url - 请求URL
 * @param {Object} options - fetch选项
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = API_TIMEOUT) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new AppError(
        '请求超时，请检查网络连接后重试',
        'TIMEOUT',
        { url, timeout }
      )
    }
    throw error
  }
}

/**
 * 认证 API 服务
 * 提供管理员登录、登出和认证状态检查功能
 * 自动处理 Token 的保存和清除
 * 
 * @namespace authAPI
 * @example
 * // 登录
 * const result = await authAPI.login('password', 'tale-historical')
 * if (result.success) {
 *   console.log('登录成功')
 * }
 * 
 * // 登出
 * authAPI.logout()
 * 
 * // 检查登录状态
 * if (authAPI.isAuthenticated()) {
 *   console.log('已登录')
 * }
 */
export const authAPI = {
  /**
   * 管理员登录
   * 验证密码并保存 Token 到 localStorage
   * 不会抛出错误，而是返回包含 success 和 error 的对象
   * 
   * @param {string} password - 管理员密码
   * @param {string} [project='tale-historical'] - 项目标识
   * @returns {Promise<Object>} 登录结果
   * @returns {boolean} returns.success - 是否登录成功
   * @returns {string} [returns.token] - JWT Token（仅在成功时存在）
   * @returns {string} [returns.error] - 错误消息（仅在失败时存在）
   * 
   * @example
   * // 登录
   * const result = await authAPI.login('notee.vip.2026', 'tale-historical')
   * if (result.success) {
   *   console.log('登录成功，Token:', result.token)
   * } else {
   *   console.error('登录失败:', result.error)
   * }
   * 
   * // 处理不同的错误
   * if (!result.success) {
   *   if (result.error === '密码错误') {
   *     showNotification('密码错误，请重试', 'error')
   *   } else if (result.error.includes('网络')) {
   *     showNotification('网络错误，请检查连接', 'error')
   *   }
   * }
   */
  login: async (password, project = 'tale-historical') => {
    try {
      logger.info('AuthAPI', '管理员登录', { project })
      
      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password, project })
      })
      
      // 先解析响应体，无论状态码是什么
      const data = await response.json()
      
      // 检查业务逻辑是否成功
      if (data.success && data.token) {
        // 保存token
        tokenManager.save(data.token)
        logger.info('AuthAPI', '登录成功')
        return { success: true, token: data.token }
      } else {
        // 返回具体的错误消息
        logger.warn('AuthAPI', '登录失败', data.error)
        return { 
          success: false, 
          error: data.error || '登录失败' 
        }
      }
    } catch (error) {
      logger.error('AuthAPI', '登录请求失败', error)
      
      // 区分超时错误和网络错误
      if (error.code === 'TIMEOUT') {
        return { 
          success: false, 
          error: '登录请求超时，请检查网络连接' 
        }
      }
      
      return { 
        success: false, 
        error: '网络错误，请检查后端服务是否运行' 
      }
    }
  },
  
  /**
   * 登出
   * 清除 localStorage 中的 Token
   * 
   * @returns {void}
   * 
   * @example
   * authAPI.logout()
   * console.log('已登出')
   */
  logout: () => {
    tokenManager.clear()
    logger.info('AuthAPI', '已登出')
  },
  
  /**
   * 检查是否已登录
   * 内部调用 tokenManager.isValid() 检查 Token 是否存在且未过期
   * 
   * @returns {boolean} true 表示已登录，false 表示未登录或 Token 已过期
   * 
   * @example
   * if (authAPI.isAuthenticated()) {
   *   // 显示管理员功能
   *   showAdminPanel()
   * } else {
   *   // 显示登录按钮
   *   showLoginButton()
   * }
   */
  isAuthenticated: () => {
    return tokenManager.isValid()
  }
}
