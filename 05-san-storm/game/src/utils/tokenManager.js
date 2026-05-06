/**
 * 管理员 Token 管理（主站后端 3001 签发）
 *
 * **与玩家 Token 的边界**：
 *   - 本模块管理的是 **管理员密码登录** 后由主站后端（3001）签发的字符串 token，键 `STORAGE_KEYS.ADMIN_TOKEN`，30 天有效期。
 *   - **玩家会话 JWT** 由 05-san-storm 后端（3005）签发、`utils/playerTokenManager.js` 管理，键 `STORAGE_KEYS.PLAYER_TOKEN`，默认 8h；与本模块**互不影响**。
 *   - 携带请求头时：管理员请求需手动附 `Authorization`；玩家请求由 `services/httpClient.js` 自动附加。
 */

import { STORAGE_KEYS, TOKEN_DURATION } from '../constants';

export const tokenManager = {
  /**
   * 保存 Token 到 localStorage
   */
  save: (token) => {
    try {
      localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token);
      localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, Date.now() + TOKEN_DURATION);
    } catch (error) {
      console.error('[TokenManager] 保存token失败:', error);
    }
  },
  
  /**
   * 获取 Token
   * 自动检查 Token 是否过期
   */
  get: () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
      
      if (!token || !expiry) {
        return null;
      }
      
      // 检查是否过期
      if (Date.now() > parseInt(expiry)) {
        tokenManager.clear();
        return null;
      }
      
      return token;
    } catch (error) {
      console.error('[TokenManager] 获取token失败:', error);
      return null;
    }
  },
  
  /**
   * 清除 Token
   */
  clear: () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    } catch (error) {
      console.error('[TokenManager] 清除token失败:', error);
    }
  },
  
  /**
   * 检查 Token 是否有效
   */
  isValid: () => {
    return tokenManager.get() !== null;
  },
  
  /**
   * 获取 Token 剩余有效时间
   */
  getTimeRemaining: () => {
    try {
      const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
      if (!expiry) return 0;
      
      const remaining = parseInt(expiry) - Date.now();
      return remaining > 0 ? remaining : 0;
    } catch (error) {
      console.error('[TokenManager] 获取剩余时间失败:', error);
      return 0;
    }
  }
};
