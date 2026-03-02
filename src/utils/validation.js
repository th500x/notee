import { MODULES } from '../constants'

/**
 * 验证器集合
 */
export const validators = {
  /**
   * 必填验证
   */
  required: (value) => {
    if (!value || value.trim() === '') {
      return '此字段为必填项'
    }
    return null
  },
  
  /**
   * 最大长度验证
   */
  maxLength: (max) => (value) => {
    if (value && value.length > max) {
      return `长度不能超过${max}个字符`
    }
    return null
  },
  
  /**
   * 模块验证
   */
  module: (value) => {
    const validModules = Object.values(MODULES)
    if (!validModules.includes(value)) {
      return '无效的模块'
    }
    return null
  },
  
  /**
   * HTML标签验证
   */
  noHtml: (value) => {
    if (/<[^>]*>/g.test(value)) {
      return '不允许包含HTML标签'
    }
    return null
  },
  
  /**
   * 特殊字符验证
   */
  noSpecialChars: (value) => {
    // 允许中文、英文、数字、常用标点
    const pattern = /^[\u4e00-\u9fa5a-zA-Z0-9\s，。！？、；：""''（）《》【】…—·,.!?;:()"'\-]+$/
    if (value && !pattern.test(value)) {
      return '包含不允许的特殊字符'
    }
    return null
  }
}

/**
 * 执行验证
 * @param {any} value - 要验证的值
 * @param {Array<Function>} rules - 验证规则数组
 * @returns {string|null} 错误信息，无错误返回null
 */
export function validate(value, rules) {
  for (const rule of rules) {
    const error = rule(value)
    if (error) {
      return error
    }
  }
  return null
}

/**
 * 验证留言表单
 * 
 * @param {string} module - 留言所属模块
 * @param {string} content - 留言内容
 * @returns {Object} 验证结果
 * @returns {boolean} returns.valid - 是否验证通过
 * @returns {Object} returns.errors - 错误信息对象，key为字段名，value为错误消息
 * 
 * @example
 * const result = validateMessageForm('general', '这是一条留言')
 * // { valid: true, errors: {} }
 * 
 * const result = validateMessageForm('', '')
 * // { valid: false, errors: { module: '此字段为必填项', content: '此字段为必填项' } }
 */
export function validateMessageForm(module, content) {
  const errors = {}
  
  // 验证模块
  const moduleError = validate(module, [
    validators.required,
    validators.module
  ])
  if (moduleError) {
    errors.module = moduleError
  }
  
  // 验证内容
  const contentError = validate(content, [
    validators.required,
    validators.maxLength(50),
    validators.noHtml
  ])
  if (contentError) {
    errors.content = contentError
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * 验证密码输入
 * 
 * @param {string} password - 用户输入的密码
 * @returns {Object} 验证结果
 * @returns {boolean} returns.valid - 是否验证通过
 * @returns {string|null} returns.error - 错误消息，验证通过时为null
 * 
 * @example
 * const result = validatePassword('123')
 * // { valid: false, error: '密码长度不能少于6个字符' }
 * 
 * const result = validatePassword('notee.vip.2026')
 * // { valid: true, error: null }
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

  return {
    valid: true,
    error: null
  }
}
