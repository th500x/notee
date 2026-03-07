/**
 * Token 管理工具
 * 用于管理用户认证 Token 的存储、获取、验证和清除
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
