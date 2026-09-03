/**
 * 一键切换 Game 门户「开发环境 / 生产环境」。
 * 使用整页跳转 + session 单次锁，避免 React StrictMode 双次 toggle 抵消。
 */
import { useEffect } from 'react';
import { readAdminDevBypass, setAdminDevBypass, isAdminDevBypassAllowed } from '@/utils/adminDevBypass';
import { authAPI } from '@/services/authApi';

const SESSION_ONCE = 'san-storm-admin-env-route-toggle-once';

export default function AdminEnvTogglePage() {
  useEffect(() => {
    const base = import.meta.env.BASE_URL;

    if (!isAdminDevBypassAllowed) {
      window.location.replace(base);
      return;
    }

    if (sessionStorage.getItem(SESSION_ONCE) === '1') {
      sessionStorage.removeItem(SESSION_ONCE);
      window.location.replace(base);
      return;
    }

    sessionStorage.setItem(SESSION_ONCE, '1');
    const wasBypass = readAdminDevBypass();
    setAdminDevBypass(!wasBypass);
    if (wasBypass) authAPI.logout();
    window.location.replace(base);
  }, []);

  return (
    <div className="flex justify-center py-24 text-sm text-gray-600">
      正在切换环境…
    </div>
  );
}
