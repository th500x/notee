/**
 * 输入验证工具
 * 提供统一的输入验证和清理功能
 */

import { LOG_PREFIX } from '../constants'

/**
 * 验证密码输入
 * @param {string} password - 密码
 * @returns {Object} { valid: boolean, error: string }
 */
export function validatePassword(password) {
  // 检查是否为空
  if (!password) {
    return {
      valid: false,
      error: '请输入密码'
    }
  }

  // 检查类型
  if (typeof password !== 'string') {
    console.warn(`${LOG_PREFIX.AUTH} 密码类型错误:`, typeof password)
    return {
      valid: false,
      error: '密码格式错误'
    }
  }

  // 检查最小长度
  if (password.trim().length < 6) {
    return {
      valid: false,
      error: '密码长度不能少于6个字符'
    }
  }

  // 检查最大长度
  if (password.length > 100) {
    return {
      valid: false,
      error: '密码长度不能超过100个字符'
    }
  }

  // 检查是否包含危险字符（基本XSS防护）
  const dangerousChars = /<|>|&|"|'|`/g
  if (dangerousChars.test(password)) {
    console.warn(`${LOG_PREFIX.AUTH} 密码包含危险字符`)
    return {
      valid: false,
      error: '密码包含非法字符'
    }
  }

  return {
    valid: true,
    error: null
  }
}

/**
 * 清理字符串输入（防止XSS）
 * @param {string} input - 输入字符串
 * @returns {string} 清理后的字符串
 */
export function sanitizeString(input) {
  if (!input || typeof input !== 'string') {
    return ''
  }

  // 移除HTML标签
  let cleaned = input.replace(/<[^>]*>/g, '')
  
  // 转义特殊字符
  cleaned = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;')
  
  // 去除首尾空格
  cleaned = cleaned.trim()
  
  return cleaned
}

/**
 * 验证书籍ID
 * @param {string} bookId - 书籍ID
 * @returns {Object} { valid: boolean, error: string }
 */
export function validateBookId(bookId) {
  if (!bookId) {
    return {
      valid: false,
      error: '书籍ID不能为空'
    }
  }

  if (typeof bookId !== 'string') {
    return {
      valid: false,
      error: '书籍ID格式错误'
    }
  }

  // 书籍ID格式：02-01-san-nanyang
  const bookIdPattern = /^[0-9]{2}-[0-9]{2}-[a-z-]+$/
  if (!bookIdPattern.test(bookId)) {
    console.warn(`${LOG_PREFIX.BOOK_CONTEXT} 无效的书籍ID:`, bookId)
    return {
      valid: false,
      error: '书籍ID格式错误'
    }
  }

  return {
    valid: true,
    error: null
  }
}

/**
 * 验证章节ID
 * @param {string} chapterId - 章节ID
 * @returns {Object} { valid: boolean, error: string }
 */
export function validateChapterId(chapterId) {
  if (!chapterId) {
    return {
      valid: false,
      error: '章节ID不能为空'
    }
  }

  if (typeof chapterId !== 'string') {
    return {
      valid: false,
      error: '章节ID格式错误'
    }
  }

  // 章节ID格式：chapter-01
  const chapterIdPattern = /^chapter-[0-9]+$/
  if (!chapterIdPattern.test(chapterId)) {
    console.warn(`${LOG_PREFIX.BOOK_READER} 无效的章节ID:`, chapterId)
    return {
      valid: false,
      error: '章节ID格式错误'
    }
  }

  return {
    valid: true,
    error: null
  }
}

/**
 * 验证书签备注
 * @param {string} note - 备注内容
 * @returns {Object} { valid: boolean, error: string, sanitized: string }
 */
export function validateBookmarkNote(note) {
  if (!note) {
    return {
      valid: true,
      error: null,
      sanitized: ''
    }
  }

  if (typeof note !== 'string') {
    return {
      valid: false,
      error: '备注格式错误',
      sanitized: ''
    }
  }

  // 限制长度
  if (note.length > 500) {
    return {
      valid: false,
      error: '备注长度不能超过500个字符',
      sanitized: ''
    }
  }

  // 清理输入
  const sanitized = sanitizeString(note)

  return {
    valid: true,
    error: null,
    sanitized
  }
}

/**
 * 验证数字范围
 * @param {number} value - 数值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @param {string} fieldName - 字段名称
 * @returns {Object} { valid: boolean, error: string }
 */
export function validateNumberRange(value, min, max, fieldName = '值') {
  if (typeof value !== 'number' || isNaN(value)) {
    return {
      valid: false,
      error: `${fieldName}必须是数字`
    }
  }

  if (value < min || value > max) {
    return {
      valid: false,
      error: `${fieldName}必须在${min}到${max}之间`
    }
  }

  return {
    valid: true,
    error: null
  }
}

/**
 * 批量验证
 * @param {Array} validations - 验证数组 [{ validator: fn, args: [] }]
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateAll(validations) {
  const errors = []

  for (const { validator, args } of validations) {
    const result = validator(...args)
    if (!result.valid) {
      errors.push(result.error)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
