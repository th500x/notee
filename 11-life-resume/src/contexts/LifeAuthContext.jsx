import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loginAccount, registerAccount } from '@/services/authApi';
import { fetchAuthMe } from '@/services/lifeResumeApi';
import { lifeResumeSession } from '@/utils/lifeResumeSession';

const LifeAuthContext = createContext(null);

export function LifeAuthProvider({ children }) {
  const [user, setUser] = useState(() => lifeResumeSession.loadUser());
  const [bootstrapping, setBootstrapping] = useState(() => lifeResumeSession.isLoggedIn());

  const applySession = useCallback((payload) => {
    const saved = lifeResumeSession.saveAuth(payload);
    setUser(saved);
    return saved;
  }, []);

  const logout = useCallback(() => {
    lifeResumeSession.clear();
    setUser(null);
  }, []);

  const login = useCallback(
    async (accountId, password) => {
      const result = await loginAccount(accountId, password);
      if (!result.success) {
        return result;
      }
      applySession(result.data);
      return { success: true, data: lifeResumeSession.loadUser() };
    },
    [applySession]
  );

  const register = useCallback(
    async (body) => {
      const result = await registerAccount(body);
      if (!result.success) {
        return result;
      }
      applySession(result.data);
      return { success: true, data: lifeResumeSession.loadUser() };
    },
    [applySession]
  );

  const refreshSession = useCallback(async () => {
    if (!lifeResumeSession.getToken()) {
      setUser(null);
      return false;
    }
    try {
      await fetchAuthMe();
      setUser(lifeResumeSession.loadUser());
      return true;
    } catch {
      logout();
      return false;
    }
  }, [logout]);

  useEffect(() => {
    if (!lifeResumeSession.isLoggedIn()) {
      setBootstrapping(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await refreshSession();
      if (!cancelled) setBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  const value = useMemo(
    () => ({
      user,
      accountId: user?.id || null,
      isLoggedIn: !!user && lifeResumeSession.isLoggedIn(),
      bootstrapping,
      login,
      register,
      logout,
      refreshSession,
    }),
    [user, bootstrapping, login, register, logout, refreshSession]
  );

  return <LifeAuthContext.Provider value={value}>{children}</LifeAuthContext.Provider>;
}

export function useLifeAuth() {
  const ctx = useContext(LifeAuthContext);
  if (!ctx) {
    throw new Error('useLifeAuth must be used within LifeAuthProvider');
  }
  return ctx;
}
