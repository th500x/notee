/**
 * 管理员子页统一门禁：校验主站 JWT 且 san-storm 后端可验签；或本地 ADMIN_DEV_BYPASS。
 * 与游戏玩家登录（`playerTokenManager`）无关。
 */

import { useState } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import AdminLoginModal from '@/components/admin/AdminLoginModal';

export default function AdminPageGate({ children }) {
  const { isLoggedIn, loading, login, sessionError } = useAdmin();
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async (password) => {
    setLoginLoading(true);
    try {
      const result = await login(password);
      if (result.success) {
        setLoginOpen(false);
      }
      return result;
    } finally {
      setLoginLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <div className="max-w-6xl mx-auto p-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center space-y-3">
            <p className="text-gray-800">此页面需要管理员权限。</p>
            {sessionError ? (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {sessionError}
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                请使用主站管理员密码登录（写入 notee-admin-token，无需游戏内账号）。
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                管理员登录
              </button>
              <a href="/05-san-storm/game/" className="px-5 py-2 text-blue-600 hover:underline inline-block">
                返回 Game 首页
              </a>
            </div>
          </div>
        </div>
        <AdminLoginModal
          isOpen={loginOpen}
          onClose={() => setLoginOpen(false)}
          onLogin={handleLogin}
          loading={loginLoading}
        />
      </>
    );
  }

  return children;
}
