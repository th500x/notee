import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLifeAuth } from '@/contexts/LifeAuthContext';
import { fetchProfileMe, updateProfileMe } from '@/services/lifeResumeApi';

const LifeProfileContext = createContext(null);

export function LifeProfileProvider({ children }) {
  const { isLoggedIn, bootstrapping } = useLifeAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshProfile = useCallback(async () => {
    if (!isLoggedIn) {
      setProfile(null);
      setError('');
      return null;
    }
    setLoading(true);
    try {
      const res = await fetchProfileMe();
      setProfile(res.data);
      setError('');
      return res.data;
    } catch (err) {
      setProfile(null);
      setError(err.message || '无法加载资料');
      return null;
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  const updateProfile = useCallback(async (body) => {
    const res = await updateProfileMe(body);
    setProfile(res.data);
    setError('');
    return res.data;
  }, []);

  useEffect(() => {
    if (bootstrapping) return undefined;
    let cancelled = false;
    (async () => {
      if (!isLoggedIn) {
        if (!cancelled) {
          setProfile(null);
          setError('');
        }
        return;
      }
      setLoading(true);
      try {
        const res = await fetchProfileMe();
        if (!cancelled) {
          setProfile(res.data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setProfile(null);
          setError(err.message || '无法加载资料');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, bootstrapping]);

  const value = useMemo(
    () => ({
      profile,
      loading,
      error,
      refreshProfile,
      updateProfile,
    }),
    [profile, loading, error, refreshProfile, updateProfile]
  );

  return <LifeProfileContext.Provider value={value}>{children}</LifeProfileContext.Provider>;
}

export function useLifeProfile() {
  const ctx = useContext(LifeProfileContext);
  if (!ctx) {
    throw new Error('useLifeProfile must be used within LifeProfileProvider');
  }
  return ctx;
}
