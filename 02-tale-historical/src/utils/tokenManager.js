import { STORAGE_KEYS, TOKEN_DURATION } from '../constants'

/**
 * Token 管理工具
 * 用于管理用户认证 Token 的存储、获取、验证和清除
 * Token 默认有效期为 30 天
 * 
 * @namespace tokenManager
 * @example
 * // 保存 token
 * tokenManager.save('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
 * 
 * // 获取 token
 * const token = tokenManager.get()
 * 
 * // 验证 token 是否有效
 * if (tokenManager.isValid()) {
 *   console.log('用户已登录')
 * }
 * 
 * // 获取剩余有效时间
 * const remaining = tokenManager.getTimeRemaining()
 * console.log(`Token 还有 ${remaining / 1000 / 60} 分钟过期`)
 * 
 * // 清除 token（登出）
 * tokenManager.clear()
 */
export const tokenManager = {
  /**
   * 保存 Token 到 localStorage
   * 同时保存过期时间（当前时间 + 30天）
   * 
   * @param {string} token - JWT token 字符串
   * @returns {void}
   * 
   * @example
   * tokenManager.save('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
   */
  save: (token) => {
    try {
      localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token)
      localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, Date.now() + TOKEN_DURATION)
    } catch (error) {
      console.error('[TokenManager] 保存token失败:', error)
    }
  },
  
  /**
   * 获取 Token
   * 自动检查 Token 是否过期，如果过期则自动清除并返回 null
   * 
   * @returns {string|null} Token 字符串，如果不存在或已过期返回 null
   * 
   * @example
   * const token = tokenManager.get()
   * if (token) {
   *   // 使用 token 调用 API
   *   fetch('/api/data', {
   *     headers: { 'Authorization': `Bearer ${token}` }
   *   })
   * }
   */
  get: () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN)
      const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY)
      
      if (!token || !expiry) {
        return null
      }
      
      // 检查是否过期
      if (Date.now() > parseInt(expiry)) {
        tokenManager.clear()
        return null
      }
      
      return token
    } catch (error) {
      console.error('[TokenManager] 获取token失败:', error)
      return null
    }
  },
  
  /**
   * 清除 Token
   * 从 localStorage 中删除 Token 和过期时间
   * 通常在用户登出或 Token 过期时调用
   * 
   * @returns {void}
   * 
   * @example
   * // 用户点击登出按钮
   * tokenManager.clear()
   * console.log('已登出')
   */
  clear: () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN)
      localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY)
    } catch (error) {
      console.error('[TokenManager] 清除token失败:', error)
    }
  },
  
  /**
   * 检查 Token 是否有效
   * 内部调用 get() 方法，如果能获取到 Token 则表示有效
   * 
   * @returns {boolean} true 表示 Token 有效，false 表示无效或已过期
   * 
   * @example
   * if (tokenManager.isValid()) {
   *   // 显示管理员功能
   *   showAdminPanel()
   * } else {
   *   // 显示登录按钮
   *   showLoginButton()
   * }
   */
  isValid: () => {
    return tokenManager.get() !== null
  },
  
  /**
   * 获取 Token 剩余有效时间
   * 
   * @returns {number} 剩余时间（毫秒），如果 Token 无效或已过期返回 0
   * 
   * @example
   * const remaining = tokenManager.getTimeRemaining()
   * const days = Math.floor(remaining / (1000 * 60 * 60 * 24))
   * console.log(`Token 还有 ${days} 天过期`)
   * 
   * // 检查是否即将过期（少于1天）
   * if (remaining < 24 * 60 * 60 * 1000) {
   *   console.warn('Token 即将过期，请重新登录')
   * }
   */
  getTimeRemaining: () => {
    try {
      const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY)
      if (!expiry) return 0
      
      const remaining = parseInt(expiry) - Date.now()
      return remaining > 0 ? remaining : 0
    } catch (error) {
      console.error('[TokenManager] 获取剩余时间失败:', error)
      return 0
    }
  }
}
