/**
 * 统一API服务层
 * 提供认证相关的API调用和数据加载
 */

import { tokenManager } from '../utils/tokenManager';
import { API_CONFIG } from '../constants';

/**
 * 带超时的fetch请求
 */
async function fetchWithTimeout(url, options = {}, timeout = API_CONFIG.TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接后重试');
    }
    throw error;
  }
}

/**
 * GET 请求 - 用于加载数据文件
 */
export async function get(url, options = {}) {
  try {
    const response = await fetchWithTimeout(url, {
      ...options,
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[API] GET请求失败:', url, error);
    throw error;
  }
}

/**
 * 认证 API 服务
 */
export const authAPI = {
  /**
   * 管理员登录
   */
  login: async (password, project = 'san-storm-game') => {
    try {
      console.log('[AuthAPI] 管理员登录', { project });
      
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password, project })
      });
      
      const data = await response.json();
      
      if (data.success && data.token) {
        tokenManager.save(data.token);
        console.log('[AuthAPI] 登录成功');
        return { success: true, token: data.token };
      } else {
        console.warn('[AuthAPI] 登录失败', data.error);
        return { 
          success: false, 
          error: data.error || '登录失败' 
        };
      }
    } catch (error) {
      console.error('[AuthAPI] 登录请求失败', error);
      
      if (error.message.includes('超时')) {
        return { 
          success: false, 
          error: '登录请求超时，请检查网络连接' 
        };
      }
      
      return { 
        success: false, 
        error: '网络错误，请检查后端服务是否运行' 
      };
    }
  },
  
  /**
   * 登出
   */
  logout: () => {
    tokenManager.clear();
    console.log('[AuthAPI] 已登出');
  },
  
  /**
   * 检查是否已登录
   */
  isAuthenticated: () => {
    return tokenManager.isValid();
  }
};
