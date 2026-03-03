/**
 * 项目密码管理工具
 * 
 * 功能：
 * - 保存用户输入的项目密码（单个密码）
 * - 检查密码是否有效（7天有效期）
 * - 通过后端验证密码并获取可访问的项目列表
 */

import * as api from './apiClient'

const STORAGE_KEY = 'rental_tracking_project_password'
const PASSWORD_DURATION = 7 * 24 * 60 * 60 * 1000 // 7天（毫秒）

/**
 * 保存项目密码（只保存一个密码）
 * @param {string} password - 项目密码
 */
export function saveProjectPassword(password) {
  if (!password) return
  
  const passwordData = {
    password,
    timestamp: Date.now()
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(passwordData))
}

/**
 * 获取有效的项目密码
 * @returns {string|null} 有效的密码，如果没有或已过期则返回 null
 */
export function getValidPassword() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    
    const passwordData = JSON.parse(stored)
    const now = Date.now()
    
    // 检查是否在有效期内
    if (now - passwordData.timestamp < PASSWORD_DURATION) {
      return passwordData.password
    }
    
    // 过期则清除
    clearPassword()
    return null
  } catch (error) {
    console.error('读取项目密码失败:', error)
    return null
  }
}

/**
 * 清除过期的密码
 */
export function cleanExpiredPasswords() {
  const password = getValidPassword()
  if (!password) {
    clearPassword()
  }
}

/**
 * 清除密码
 */
export function clearPassword() {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * 通过后端验证密码并获取可访问的项目列表
 * @param {string} password - 用户的密码
 * @returns {Promise<Array>} 可访问的项目列表
 */
export async function getAccessibleProjects(password) {
  if (!password) return []
  
  try {
    const response = await api.verifyPasswordAndGetProjects(password)
    return response.projects || []
  } catch (error) {
    console.error('验证密码失败:', error)
    return []
  }
}

/**
 * 根据密码过滤可访问的项目（已废弃，使用 getAccessibleProjects 代替）
 * @deprecated 使用 getAccessibleProjects 通过后端验证
 */
export function filterAccessibleProjects(projects, password) {
  console.warn('filterAccessibleProjects 已废弃，请使用 getAccessibleProjects')
  if (!projects || projects.length === 0) return []
  if (!password) return []
  
  return projects.filter(project => {
    // 如果项目没有密码，所有人都可以访问
    if (!project.hasPassword) {
      return true
    }
    
    // 有密码的项目需要通过后端验证，这里无法判断
    return false
  })
}

