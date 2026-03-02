/**
 * 全局认证服务
 * 与3001端口的认证API交互
 * 
 * @module services/authService
 */

import { LOG_PREFIX } from '../constants'

// API配置
const API_BASE = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3001/api/auth'
const TOKEN_KEY = 'notee-global-token'

/**
 * 登录验证
 * 
 * @param {string} password - 用户输入的密码
 * @returns {Promise<Object>} { success, token?, error? }
 */
export async function login(password) {
  try {
    console.log(`${LOG_PREFIX.AUTH} 发起登录请求`)
    
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        password,
        project: 'tale-historical'
      })
    })
    
    const data = await response.json()
    
    if (data.success && data.token) {
      // 保存token到localStorage
      localStorage.setItem(TOKEN_KEY, data.token)
      console.log(`${LOG_PREFIX.AUTH} 登录成功`)
      return { success: true, token: data.token }
    } else {
      console.warn(`${LOG_PREFIX.AUTH} 登录失败:`, data.error)
      return { success: false, error: data.error || '登录失败' }
    }
  } catch (error) {
    console.error(`${LOG_PREFIX.AUTH} 登录请求失败:`, error)
    return { 
      success: false, 
      error: '网络错误，请检查后端服务是否运行' 
    }
  }
}

/**
 * 验证token有效性
 * 
 * @returns {Promise<boolean>} token是否有效
 */
export async function verifyToken() {
  try {
    const token = getToken()
    if (!token) {
      return false
    }
    
    const response = await fetch(`${API_BASE}/verify`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`
      }
    })
    
    const data = await response.json()
    
    if (data.valid) {
      console.log(`${LOG_PREFIX.AUTH} Token验证成功`)
      return true
    } else {
      console.warn(`${LOG_PREFIX.AUTH} Token无效`)
      clearToken()
      return false
    }
  } catch (error) {
    console.error(`${LOG_PREFIX.AUTH} Token验证失败:`, error)
    return false
  }
}

/**
 * 刷新token
 * 
 * @returns {Promise<boolean>} 是否刷新成功
 */
export async function refreshToken() {
  try {
    const token = getToken()
    if (!token) {
      return false
    }
    
    const response = await fetch(`${API_BASE}/refresh`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`
      }
    })
    
    const data = await response.json()
    
    if (data.success && data.token) {
      localStorage.setItem(TOKEN_KEY, data.token)
      console.log(`${LOG_PREFIX.AUTH} Token刷新成功`)
      return true
    } else {
      console.warn(`${LOG_PREFIX.AUTH} Token刷新失败`)
      clearToken()
      return false
    }
  } catch (error) {
    console.error(`${LOG_PREFIX.AUTH} Token刷新失败:`, error)
    return false
  }
}

/**
 * 获取存储的token
 * 
 * @returns {string|null} token或null
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * 清除token（登出）
 */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  console.log(`${LOG_PREFIX.AUTH} Token已清除`)
}

/**
 * 检查是否已登录
 * 
 * @returns {boolean} 是否有token
 */
export function isLoggedIn() {
  return !!getToken()
}
