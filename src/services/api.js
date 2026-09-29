import { config } from '../config'
import { AppError, logger } from '../utils/errorHandler'
import { tokenManager } from '../utils/tokenManager'

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

export const authAPI = {
  login: async (password, project = 'notee') => {
    try {
      logger.info('AuthAPI', '管理员登录', { project })

      const response = await fetchWithTimeout(`${config.api.auth}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password, project })
      })

      const data = await response.json()

      if (data.success && data.token) {
        tokenManager.save(data.token)
        logger.info('AuthAPI', '登录成功')
        return { success: true, token: data.token }
      }

      logger.warn('AuthAPI', '登录失败', data.error)
      return {
        success: false,
        error: data.error || '登录失败'
      }
    } catch (error) {
      logger.error('AuthAPI', '登录请求失败', error)

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

  logout: () => {
    tokenManager.clear()
    logger.info('AuthAPI', '已登出')
  },

  isAuthenticated: () => {
    return tokenManager.isValid()
  }
}
