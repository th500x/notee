/**
 * 管理员认证自定义 Hook
 * 管理管理员的登录状态、登录和登出功能
 *
 * 【上线前】将下方 `useState(true)` 改回 `useState(false)`，恢复 useEffect 内
 * tokenManager.isValid() / setIsLoggedIn 两行（去掉注释），并删除「本地临时管理员」相关注释。
 */
import { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { tokenManager } from '../utils/tokenManager';

export function useAdmin() {
  // 本地开发环境：临时开启管理员（首页直接显示管理入口；不依赖本地 token）
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // const isValid = tokenManager.isValid();
    // setIsLoggedIn(isValid);
  }, []);

  /**
   * 管理员登录
   */
  const login = async (password) => {
    try {
      setLoading(true);
      
      console.log('[useAdmin] 尝试登录');
      
      const result = await authAPI.login(password, 'san-storm-game');
      
      if (result.success) {
        setIsLoggedIn(true);
        console.log('[useAdmin] 登录成功');
        return { success: true };
      } else {
        console.warn('[useAdmin] 登录失败', result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('[useAdmin] 登录异常', err);
      return { success: false, error: '登录失败，请重试' };
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 管理员登出
   */
  const logout = () => {
    authAPI.logout();
    setIsLoggedIn(false);
    console.log('[useAdmin] 已登出');
  };
  
  return {
    isLoggedIn,
    loading,
    login,
    logout
  };
}
