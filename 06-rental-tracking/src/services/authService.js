/**
 * 认证服务
 * 封装所有与认证相关的API调用
 */

import { config } from '../config'
import { tokenManager } from '../utils/tokenManager'

/**
 * 认证服务对象
 */
export const authService = {
  /**
   * 管理员登录
   * @param {string} password - 管理员密码
   * @returns {Promise<Object>} 登录结果 { success, token?, error? }
   */
  login: async (password) => {
    try {
      console.log('[AuthService] 管理员登录', { project: 'rental-tracking' })
      
      const response = await fetch(
        `${config.api.baseUrl}/api/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            password,
            project: 'rental-tracking'
          })
        }
      )
      
      // 先解析响应体，无论状态码是什么
      const data = await response.json()
      
      // 检查业务逻辑是否成功
      if (data.success && data.token) {
        // 保存token
        tokenManager.save(data.token)
        console.log('[AuthService] 登录成功')
        return { success: true, token: data.token }
      } else {
        // 返回具体的错误消息
        console.warn('[AuthService] 登录失败', data.error)
        return { 
          success: false, 
          error: data.error || '登录失败' 
        }
      }
    } catch (error) {
      console.error('[AuthService] 登录请求失败', error)
      
      return { 
        success: false, 
        error: '网络错误，请检查后端服务是否运行' 
      }
    }
  },
  
  /**
   * 验证token是否有效
   * @param {string} token - 要验证的token
   * @returns {Promise<Object>} 验证结果 { success, valid }
   */
  verifyToken: async (token) => {
    try {
      const response = await fetch(
        `${config.api.baseUrl}/api/auth/verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      )
      
      if (!response.ok) {
        return { success: false, valid: false }
      }
      
      const data = await response.json()
      return data
    } catch (error) {
      console.error('[AuthService] 验证token失败:', error)
      return { success: false, valid: false }
    }
  },
  
  /**
   * 登出
   */
  logout: () => {
    tokenManager.clear()
    console.log('[AuthService] 已登出')
  },
  
  /**
   * 检查是否已登录
   * @returns {boolean} 是否已登录
   */
  isAuthenticated: () => {
    return tokenManager.isValid()
  },
  
  /**
   * 获取当前token
   * @returns {string|null} 当前token
   */
  getToken: () => {
    return tokenManager.get()
  }
}


