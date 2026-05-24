/**
 * 管理员认证自定义 Hook
 * 管理管理员的登录状态、登录和登出功能
 *
 * 生产默认：须 `notee-admin-token` 有效；开发 bypass 见 `utils/adminDevBypass.js` 与首页环境切换卡片。
 */
import { useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import { tokenManager } from '../utils/tokenManager';
import {
  readAdminDevBypass,
  setAdminDevBypass,
  subscribeAdminDevBypass,
} from '../utils/adminDevBypass';

function resolveLoggedIn(devBypass) {
  if (devBypass) return true;
  return tokenManager.isValid();
}

export function useAdmin() {
  const [devBypass, setDevBypass] = useState(() => readAdminDevBypass());
  const [isLoggedIn, setIsLoggedIn] = useState(() => resolveLoggedIn(readAdminDevBypass()));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return subscribeAdminDevBypass((enabled) => {
      setDevBypass(enabled);
      setIsLoggedIn(resolveLoggedIn(enabled));
    });
  }, []);

  useEffect(() => {
    if (devBypass) return;
    setIsLoggedIn(tokenManager.isValid());
  }, [devBypass]);

  const toggleDevBypass = useCallback(() => {
    const next = !readAdminDevBypass();
    setAdminDevBypass(next);
    if (next) {
      setIsLoggedIn(true);
      return;
    }
    authAPI.logout();
    setIsLoggedIn(false);
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
      }
      console.warn('[useAdmin] 登录失败', result.error);
      return { success: false, error: result.error };
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
    setIsLoggedIn(resolveLoggedIn(readAdminDevBypass()));
    console.log('[useAdmin] 已登出');
  };

  return {
    isLoggedIn,
    loading,
    login,
    logout,
    devBypass,
    toggleDevBypass,
  };
}
