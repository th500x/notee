/**
 * 管理员登录 API（**主站后端 3001**，对应 `API_CONFIG.AUTH_BASE_URL`）
 *
 * 与游戏玩家会话（`playerTokenManager` / 3005）**完全独立**：
 *   - 这里写 / 读的是 `tokenManager`，给"管理员后台"链路用（如 `useAdmin.js`）。
 *   - 玩家自身注册 / 登录走 `gameUserApi.js`，token 进 `playerTokenManager`，由 `httpClient` 自动附加。
 *
 * @module services/authApi
 */

import { tokenManager } from '../utils/tokenManager';
import { API_CONFIG } from '../constants';
import { fetchWithTimeout } from './httpClient';

export const authAPI = {
  /**
   * 管理员登录（主站 3001）
   */
  login: async (password, project = 'san-storm-game') => {
    try {
      console.log('[AuthAPI] 管理员登录', { project });

      const response = await fetchWithTimeout(`${API_CONFIG.AUTH_BASE_URL}/api/auth/login`, {
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

  logout: () => {
    tokenManager.clear();
    console.log('[AuthAPI] 已登出');
  },

  isAuthenticated: () => {
    return tokenManager.isValid();
  },
};

export default authAPI;
