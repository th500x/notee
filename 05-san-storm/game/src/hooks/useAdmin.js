/**
 * 管理员认证自定义 Hook
 * 管理管理员的登录状态、登录和登出功能
 *
 * 生产默认：须 `notee-admin-token` 有效且 san-storm 后端可验签；开发 bypass 见 `adminDevBypass.js`。
 */
import { useState, useEffect, useCallback } from 'react';
import { authAPI } from '@/services/authApi';
import { tokenManager } from '../utils/tokenManager';
import {
  readAdminDevBypass,
  setAdminDevBypass,
  subscribeAdminDevBypass,
} from '../utils/adminDevBypass';
import { onAdminSessionExpired } from '../utils/sessionEvents';

export function useAdmin() {
  const [devBypass, setDevBypass] = useState(() => readAdminDevBypass());
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    setSessionError('');

    const bypass = readAdminDevBypass();
    setDevBypass(bypass);

    if (bypass) {
      setIsLoggedIn(true);
      setLoading(false);
      return;
    }

    if (!tokenManager.isValid()) {
      setIsLoggedIn(false);
      setLoading(false);
      return;
    }

    const verify = await authAPI.verifySanStormSession();
    if (verify.ok) {
      setIsLoggedIn(true);
      setLoading(false);
      return;
    }

    if (verify.reason === 'GLOBAL_JWT_NOT_CONFIGURED') {
      setSessionError(
        verify.error ||
          '服务端未配置 GLOBAL_JWT_SECRET，请联系运维在 san-storm 后端 .env 设置与主站 JWT_SECRET 相同的值'
      );
      setIsLoggedIn(false);
      setLoading(false);
      return;
    }

    if (verify.reason === 'NO_TOKEN' || verify.reason === 'BAD_TOKEN' || verify.reason === 'TOKEN_EXPIRED') {
      setIsLoggedIn(false);
      setLoading(false);
      return;
    }

    // 网络抖动：保留本地 token 态，避免完全不可用
    setIsLoggedIn(tokenManager.isValid());
    if (verify.error) setSessionError(verify.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    return subscribeAdminDevBypass(() => {
      refreshSession();
    });
  }, [refreshSession]);

  useEffect(() => {
    return onAdminSessionExpired(() => {
      refreshSession();
    });
  }, [refreshSession]);

  const toggleDevBypass = useCallback(() => {
    const next = !readAdminDevBypass();
    setAdminDevBypass(next);
    if (next) {
      setIsLoggedIn(true);
      setSessionError('');
      return;
    }
    authAPI.logout();
    refreshSession();
  }, [refreshSession]);

  const login = async (password) => {
    try {
      setLoading(true);
      setSessionError('');

      const result = await authAPI.login(password, 'san-storm-game');
      if (!result.success) {
        return { success: false, error: result.error };
      }

      const verify = await authAPI.verifySanStormSession();
      if (!verify.ok) {
        tokenManager.clear();
        const msg =
          verify.reason === 'GLOBAL_JWT_NOT_CONFIGURED'
            ? verify.error || '服务端未配置 GLOBAL_JWT_SECRET，无法完成管理员登录'
            : verify.error || '登录成功但后端拒绝令牌，请检查 GLOBAL_JWT_SECRET 是否与主站一致';
        setSessionError(msg);
        setIsLoggedIn(false);
        return { success: false, error: msg };
      }

      setIsLoggedIn(true);
      return { success: true };
    } catch (err) {
      console.error('[useAdmin] 登录异常', err);
      return { success: false, error: '登录失败，请重试' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    authAPI.logout();
    setSessionError('');
    refreshSession();
  };

  return {
    isLoggedIn,
    loading,
    login,
    logout,
    devBypass,
    toggleDevBypass,
    sessionError,
    refreshSession,
  };
}
