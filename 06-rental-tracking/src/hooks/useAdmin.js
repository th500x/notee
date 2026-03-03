import { useState, useEffect } from 'react'
import { authService } from '../services/authService'
import { tokenManager } from '../utils/tokenManager'

/**
 * 管理员认证自定义 Hook
 * 管理管理员的登录状态、登录和登出功能
 * 自动检查 localStorage 中的 Token 以恢复登录状态
 * 
 * @returns {Object} 管理员状态和操作方法
 * @returns {boolean} returns.isLoggedIn - 是否已登录
 * @returns {boolean} returns.loading - 登录操作是否正在进行中
 * @returns {Function} returns.login - 登录方法，返回 Promise<{success, error?}>
 * @returns {Function} returns.logout - 登出方法
 * 
 * @example
 * // 基础使用
 * const { isLoggedIn, loading, login, logout } = useAdmin()
 * 
 * // 登录
 * const handleLogin = async (password) => {
 *   const result = await login(password)
 *   if (result.success) {
 *     alert('登录成功')
 *   } else {
 *     alert(result.error)
 *   }
 * }
 * 
 * // 登出
 * const handleLogout = () => {
 *   logout()
 *   alert('已登出')
 * }
 */
export function useAdmin() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  
  /**
   * 检查登录状态
   */
  useEffect(() => {
    const isValid = tokenManager.isValid()
    setIsLoggedIn(isValid)
    
    if (isValid) {
      console.log('[useAdmin] 管理员已登录')
    }
  }, [])
  
  /**
   * 管理员登录
   * 验证密码并保存 Token，登录成功后状态会持久化到 localStorage
   * 
   * @param {string} password - 管理员密码
   * @returns {Promise<Object>} 登录结果
   * @returns {boolean} returns.success - 是否登录成功
   * @returns {string} [returns.error] - 错误消息（仅在失败时存在）
   */
  const login = async (password) => {
    try {
      setLoading(true)
      
      console.log('[useAdmin] 尝试登录')
      
      const result = await authService.login(password)
      
      if (result.success) {
        setIsLoggedIn(true)
        console.log('[useAdmin] 登录成功')
        return { success: true }
      } else {
        console.warn('[useAdmin] 登录失败', result.error)
        return { success: false, error: result.error }
      }
    } catch (err) {
      console.error('[useAdmin] 登录异常', err)
      return { success: false, error: err.message || '登录失败，请重试' }
    } finally {
      setLoading(false)
    }
  }
  
  /**
   * 管理员登出
   * 清除 Token 并更新登录状态
   */
  const logout = () => {
    authService.logout()
    setIsLoggedIn(false)
    console.log('[useAdmin] 已登出')
  }
  
  return {
    isLoggedIn,
    loading,
    login,
    logout
  }
}

