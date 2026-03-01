/**
 * 密码尝试限制工具
 * 
 * @description 统一管理密码尝试次数限制，防止暴力破解
 * @module utils/passwordAttemptLimiter
 * 
 * 使用场景：
 * - 上锁分类登录
 * - 其他需要密码验证的场景
 * 
 * 限制规则：
 * - 短期内最多尝试5次
 * - 超过5次后锁定10分钟
 * - 10分钟后自动解锁
 */

import { PASSWORD_ATTEMPT_CONFIG, STORAGE_KEYS } from '../constants'

// 配置常量
const MAX_ATTEMPTS = PASSWORD_ATTEMPT_CONFIG.MAX_ATTEMPTS
const LOCKOUT_DURATION = PASSWORD_ATTEMPT_CONFIG.LOCKOUT_DURATION
const STORAGE_KEY_PREFIX = STORAGE_KEYS.PASSWORD_ATTEMPT

/**
 * 获取尝试记录
 * @param {string} identifier - 标识符（如：'global_admin', 'category_lock'）
 * @returns {Object} 尝试记录
 */
function getAttemptRecord(identifier) {
  const key = STORAGE_KEY_PREFIX + identifier
  const record = localStorage.getItem(key)
  
  if (!record) {
    return {
      attempts: 0,
      lockedUntil: null
    }
  }
  
  try {
    return JSON.parse(record)
  } catch (e) {
    console.error('[passwordAttemptLimiter] 解析记录失败:', e)
    return {
      attempts: 0,
      lockedUntil: null
    }
  }
}

/**
 * 保存尝试记录
 * @param {string} identifier - 标识符
 * @param {Object} record - 尝试记录
 */
function saveAttemptRecord(identifier, record) {
  const key = STORAGE_KEY_PREFIX + identifier
  try {
    localStorage.setItem(key, JSON.stringify(record))
  } catch (e) {
    console.error('[passwordAttemptLimiter] 保存记录失败:', e)
  }
}

/**
 * 检查是否被锁定
 * @param {string} identifier - 标识符
 * @returns {Object} { isLocked: boolean, remainingTime: number }
 */
export function checkLockStatus(identifier) {
  const record = getAttemptRecord(identifier)
  
  if (!record.lockedUntil) {
    return { isLocked: false, remainingTime: 0 }
  }
  
  const now = Date.now()
  const remainingTime = record.lockedUntil - now
  
  // 如果锁定时间已过，自动解锁
  if (remainingTime <= 0) {
    saveAttemptRecord(identifier, {
      attempts: 0,
      lockedUntil: null
    })
    return { isLocked: false, remainingTime: 0 }
  }
  
  return { isLocked: true, remainingTime }
}

/**
 * 记录失败尝试
 * @param {string} identifier - 标识符
 * @returns {Object} { isLocked: boolean, remainingAttempts: number, remainingTime: number }
 */
export function recordFailedAttempt(identifier) {
  const record = getAttemptRecord(identifier)
  
  // 增加尝试次数
  record.attempts += 1
  
  // 检查是否达到最大尝试次数
  if (record.attempts >= MAX_ATTEMPTS) {
    // 锁定账号
    record.lockedUntil = Date.now() + LOCKOUT_DURATION
    saveAttemptRecord(identifier, record)
    
    return {
      isLocked: true,
      remainingAttempts: 0,
      remainingTime: LOCKOUT_DURATION
    }
  }
  
  // 未达到最大次数，保存记录
  saveAttemptRecord(identifier, record)
  
  return {
    isLocked: false,
    remainingAttempts: MAX_ATTEMPTS - record.attempts,
    remainingTime: 0
  }
}

/**
 * 记录成功尝试（清除记录）
 * @param {string} identifier - 标识符
 */
export function recordSuccessfulAttempt(identifier) {
  saveAttemptRecord(identifier, {
    attempts: 0,
    lockedUntil: null
  })
}

/**
 * 格式化剩余时间
 * @param {number} milliseconds - 毫秒数
 * @returns {string} 格式化的时间字符串
 */
export function formatRemainingTime(milliseconds) {
  const minutes = Math.ceil(milliseconds / 60000)
  return `${minutes}分钟`
}

/**
 * 获取错误提示信息
 * @param {Object} result - recordFailedAttempt 的返回结果
 * @returns {string} 错误提示信息
 */
export function getErrorMessage(result) {
  if (result.isLocked) {
    const timeStr = formatRemainingTime(result.remainingTime)
    return `密码错误次数过多，请${timeStr}后重试`
  }
  
  return `密码错误，还可以尝试 ${result.remainingAttempts} 次`
}

/**
 * 获取锁定提示信息
 * @param {number} remainingTime - 剩余锁定时间（毫秒）
 * @returns {string} 锁定提示信息
 */
export function getLockoutMessage(remainingTime) {
  const timeStr = formatRemainingTime(remainingTime)
  return `密码错误次数过多，请${timeStr}后重试`
}

// 导出配置常量（供外部使用）
export { PASSWORD_ATTEMPT_CONFIG }
