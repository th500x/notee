import { config } from '../config'
import { AppError, logger } from '../utils/errorHandler'
import { tokenManager } from '../utils/tokenManager'
import { performanceMonitor } from '../utils/performance'
import LRUCache from '../utils/cache'

// 创建缓存实例
const cache = new LRUCache(
  config.cache.maxSize,
  config.cache.duration
)

/**
 * 带超时的fetch请求
 * @param {string} url - 请求URL
 * @param {Object} options - fetch选项
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = config.api.timeout) {
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
 * 留言板 API 服务
 * 提供留言的获取、创建和删除功能
 * 自动处理缓存、错误处理和日志记录
 * 
 * @namespace guestbookAPI
 * @example
 * // 获取留言列表
 * const data = await guestbookAPI.getMessages('general', 20)
 * console.log(data.messages)
 * 
 * // 提交留言
 * await guestbookAPI.createMessage('general', '这是一条留言')
 * 
 * // 删除留言（需要管理员权限）
 * await guestbookAPI.deleteMessage('1234567890')
 */
export const guestbookAPI = {
  /**
   * 获取留言列表
   * 支持按模块筛选和数量限制，自动使用缓存提升性能
   * 
   * @param {string} [module='all'] - 模块筛选，'all' 表示所有模块
   * @param {number} [limit=20] - 返回的留言数量限制
   * @returns {Promise<Object>} 留言数据对象
   * @returns {boolean} returns.success - 是否成功
   * @returns {Array} returns.messages - 留言数组
   * @returns {number} returns.total - 留言总数
   * @throws {AppError} 当请求失败时抛出错误
   * 
   * @example
   * // 获取所有留言
   * const data = await guestbookAPI.getMessages('all', 20)
   * 
   * // 获取特定模块的留言
   * const data = await guestbookAPI.getMessages('01-news-calendar', 10)
   * 
   * // 处理错误
   * try {
   *   const data = await guestbookAPI.getMessages()
   * } catch (error) {
   *   console.error('获取留言失败:', error.message)
   * }
   */
  getMessages: async (module = 'all', limit = 20) => {
    return performanceMonitor.measureAsync('API.getMessages', async () => {
      const cacheKey = `messages_${module}_${limit}`
      
      // 检查缓存
      if (config.features.enableCache) {
        const cached = cache.get(cacheKey)
        if (cached) {
          logger.info('GuestbookAPI', '从缓存加载留言')
          return cached
        }
      }
      
      try {
        const url = `${config.api.guestbook}/messages?module=${module}&limit=${limit}`
        logger.info('GuestbookAPI', '请求留言列表', { module, limit })
        
        const response = await fetchWithTimeout(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          throw new AppError(
            `HTTP ${response.status}: ${response.statusText}`,
            'HTTP_ERROR',
            { status: response.status }
          )
        }
        
        const data = await response.json()
        
        if (!data.success) {
          throw new AppError(
            data.error || '获取留言失败',
            'API_ERROR',
            data
          )
        }
        
        // 存入缓存
        if (config.features.enableCache) {
          cache.set(cacheKey, data)
        }
        
        return data
      } catch (error) {
        logger.error('GuestbookAPI', '获取留言失败', error)
        throw error instanceof AppError ? error : new AppError(
          `获取留言失败: ${error.message}`,
          'FETCH_ERROR',
          error
        )
      }
    })
  },
  
  /**
   * 提交留言
   * 提交成功后会自动清除缓存，确保留言列表更新
   * 
   * @param {string} module - 留言所属模块
   * @param {string} content - 留言内容，最多 50 个字符
   * @returns {Promise<Object>} 提交结果
   * @returns {boolean} returns.success - 是否成功
   * @returns {string} returns.message - 成功消息
   * @returns {Object} returns.data - 新留言的数据（包含 id 和 timestamp）
   * @throws {AppError} 当提交失败时抛出错误
   * 
   * @example
   * // 提交留言
   * const result = await guestbookAPI.createMessage('general', '这是一条留言')
   * console.log('留言ID:', result.data.id)
   * 
   * // 处理错误
   * try {
   *   await guestbookAPI.createMessage('general', '留言内容')
   * } catch (error) {
   *   if (error.code === 'VALIDATION_ERROR') {
   *     console.error('验证失败:', error.message)
   *   }
   * }
   */
  createMessage: async (module, content) => {
    return performanceMonitor.measureAsync('API.createMessage', async () => {
      try {
        logger.info('GuestbookAPI', '提交留言', { module, content })
        
        const response = await fetchWithTimeout(`${config.api.guestbook}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ module, content })
        })
        
        if (!response.ok) {
          throw new AppError(
            `HTTP ${response.status}: ${response.statusText}`,
            'HTTP_ERROR',
            { status: response.status }
          )
        }
        
        const data = await response.json()
        
        if (!data.success) {
          throw new AppError(
            data.error || '提交留言失败',
            'API_ERROR',
            data
          )
        }
        
        // 智能缓存失效：只清除相关模块的缓存
        cache.invalidate(new RegExp(`^messages_(all|${module})_`))
        logger.info('GuestbookAPI', '清除缓存', { pattern: `messages_(all|${module})_*` })
        
        return data
      } catch (error) {
        logger.error('GuestbookAPI', '提交留言失败', error)
        throw error instanceof AppError ? error : new AppError(
          `提交留言失败: ${error.message}`,
          'CREATE_ERROR',
          error
        )
      }
    })
  },
  
  /**
   * 删除留言
   * 需要管理员权限（已登录），删除成功后会自动清除缓存
   * 如果 Token 过期会自动清除并抛出错误
   * 
   * @param {string} messageId - 要删除的留言 ID
   * @returns {Promise<Object>} 删除结果
   * @returns {boolean} returns.success - 是否成功
   * @returns {string} returns.message - 成功消息
   * @throws {AppError} 当删除失败时抛出错误，错误代码可能为 UNAUTHORIZED（未登录）
   * 
   * @example
   * // 删除留言
   * try {
   *   await guestbookAPI.deleteMessage('1234567890')
   *   console.log('删除成功')
   * } catch (error) {
   *   if (error.code === 'UNAUTHORIZED') {
   *     console.error('请先登录')
   *     // 跳转到登录页面
   *   } else {
   *     console.error('删除失败:', error.message)
   *   }
   * }
   */
  deleteMessage: async (messageId) => {
    const token = tokenManager.get()
    if (!token) {
      throw new AppError('未登录', 'UNAUTHORIZED')
    }
    
    try {
      logger.info('GuestbookAPI', '删除留言', { messageId })
      
      const response = await fetchWithTimeout(`${config.api.guestbook}/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          tokenManager.clear()
          throw new AppError('登录已过期，请重新登录', 'UNAUTHORIZED')
        }
        throw new AppError(
          `HTTP ${response.status}: ${response.statusText}`,
          'HTTP_ERROR',
          { status: response.status }
        )
      }
      
      const data = await response.json()
      
      if (!data.success) {
        throw new AppError(
          data.error || '删除留言失败',
          'API_ERROR',
          data
        )
      }
      
      // 智能缓存失效：清除所有留言列表缓存（因为不知道被删除的留言属于哪个模块）
      cache.invalidate(/^messages_/)
      logger.info('GuestbookAPI', '清除所有留言缓存')
      
      return data
    } catch (error) {
      logger.error('GuestbookAPI', '删除留言失败', error)
      throw error instanceof AppError ? error : new AppError(
        `删除留言失败: ${error.message}`,
        'DELETE_ERROR',
        error
      )
    }
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
 * const result = await authAPI.login('password', 'guestbook')
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
   * @param {string} [project='guestbook'] - 项目标识
   * @returns {Promise<Object>} 登录结果
   * @returns {boolean} returns.success - 是否登录成功
   * @returns {string} [returns.token] - JWT Token（仅在成功时存在）
   * @returns {string} [returns.error] - 错误消息（仅在失败时存在）
   * 
   * @example
   * // 登录
   * const result = await authAPI.login('notee.vip.2026', 'guestbook')
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
  login: async (password, project = 'guestbook') => {
    try {
      logger.info('AuthAPI', '管理员登录', { project })
      
      const response = await fetchWithTimeout(`${config.api.auth}/login`, {
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
