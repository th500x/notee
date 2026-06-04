/**
 * 首页 ?toggleAdminEnv=1 一键切换开发/生产 bypass（避免 StrictMode 双次 effect 抵消）。
 */
import { useLayoutEffect } from 'react';
import { readAdminDevBypass, setAdminDevBypass, isAdminDevBypassAllowed } from '@/utils/adminDevBypass';
import { authAPI } from '@/services/authApi';

const SESSION_ONCE = 'san-storm-admin-env-query-toggle-once';

export default function AdminEnvQueryToggle() {
  useLayoutEffect(() => {
    if (!isAdminDevBypassAllowed) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('toggleAdminEnv') !== '1') return;

    const base = import.meta.env.BASE_URL;

    if (sessionStorage.getItem(SESSION_ONCE) === '1') {
      sessionStorage.removeItem(SESSION_ONCE);
      window.history.replaceState(null, '', base);
      return;
    }

    sessionStorage.setItem(SESSION_ONCE, '1');
    const wasBypass = readAdminDevBypass();
    setAdminDevBypass(!wasBypass);
    if (wasBypass) authAPI.logout();
    window.location.replace(base);
  }, []);

  return null;
}
