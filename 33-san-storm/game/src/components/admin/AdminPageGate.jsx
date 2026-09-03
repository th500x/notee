/**
 * 管理员子页统一门禁：仅校验主站 JWT（`notee-admin-token`）或本地 ADMIN_DEV_BYPASS。
 * 与游戏玩家登录（`playerTokenManager`）无关。
 */

import { useAdmin } from '@/hooks/useAdmin';

export default function AdminPageGate({ children }) {
  const { isLoggedIn, loading } = useAdmin();

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center space-y-3">
          <p className="text-gray-800">此页面需要管理员权限。</p>
          <p className="text-sm text-gray-600">
            请在 notee.vip 主站页脚通过管理员入口登录（写入主站 JWT，无需游戏内账号）。
          </p>
          <a href="/" className="text-blue-600 hover:underline inline-block">
            前往主站
          </a>
        </div>
      </div>
    );
  }

  return children;
}
