import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import M2VerificationPage from '@/pages/demo/M2VerificationPage';
import AuthFlowPage from '@/pages/AuthFlowPage';
import UserManagerPage from '@/pages/admin/UserManagerPage';
import CampaignListPage from '@/pages/demo/CampaignListPage';
import CampaignDetailPage from '@/pages/demo/CampaignDetailPage';
import AncientModalDemo from '@/pages/demo/AncientModalDemo';
import GameIntroDemo from '@/pages/demo/GameIntroDemo';
import { useAdmin } from '@/hooks/useAdmin';

function App() {
  const { isLoggedIn, loading, login, logout } = useAdmin();
  // 本地开发：跳过管理员认证，所有卡片直接可见
  const isDev = import.meta.env.DEV;
  const showUserManager = isDev || isLoggedIn;
  
  // 管理员登录对话框状态
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const result = await login(password);
    if (result.success) {
      setShowLoginDialog(false);
      setPassword('');
    } else {
      setLoginError(result.error || '登录失败');
    }
  };
  return (
    <Router basename="/05-san-storm/game">
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex justify-between items-center">
              <div>
                <a 
                  href="/05-san-storm/"
                  className="text-3xl font-bold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer relative group inline-block"
                >
                  真三風雲 - 游戏系统
                  <span className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    返回主页
                  </span>
                </a>
                <p className="text-gray-600 mt-2">三国策略战棋游戏 - 游戏功能模块</p>
              </div>
              <div>
                {isLoggedIn ? (
                  <button
                    onClick={logout}
                    className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                  >
                    🔓 登出管理
                  </button>
                ) : (
                  <button
                    onClick={() => setShowLoginDialog(true)}
                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-500 rounded hover:bg-gray-200 transition-colors"
                  >
                    🔒 管理员
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={
              <div className="space-y-8">
                {/* 游戏标题和介绍 */}
                <div className="text-center py-12">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    真三風雲书写半生
                  </h2>
                  <p className="text-3xl font-bold text-gray-900">
                    三国策略战棋游戏
                  </p>
                </div>

                {/* 功能导航 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  <a href={`${import.meta.env.BASE_URL}san_1`} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                    <div className="text-4xl mb-4">🎯</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">[黄巾之乱]</h3>
                    <p className="text-sm text-gray-600">真三风云 - 赛季1</p>
                  </a>
                  {showUserManager && (
                    <>
                      <a href={`${import.meta.env.BASE_URL}m2-verification`} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border-2 border-red-300">
                        <div className="text-4xl mb-4">⚔️</div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">部队编组</h3>
                        <p className="text-sm text-gray-600">M2验证模块-1</p>
                      </a>
                      <a href={`${import.meta.env.BASE_URL}m2-verification-3`} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border-2 border-red-300">
                        <div className="text-4xl mb-4">🗺️</div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">战役地图</h3>
                        <p className="text-sm text-gray-600">M2验证模块-3</p>
                      </a>
                      <a href={`${import.meta.env.BASE_URL}demo/ancient-modal`} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border-2 border-amber-300">
                        <div className="text-4xl mb-4">🏯</div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">古风弹窗</h3>
                        <p className="text-sm text-gray-600">Demo - AncientModal组件</p>
                      </a>
                      <a href={`${import.meta.env.BASE_URL}demo/game-intro`} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border-2 border-amber-300">
                        <div className="text-4xl mb-4">📜</div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">游戏序章</h3>
                        <p className="text-sm text-gray-600">Demo - GameIntroOverlay组件</p>
                      </a>
                    </>
                  )}
                  {isLoggedIn && (
                    <a href={`${import.meta.env.BASE_URL}user-manager`} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border-2 border-red-300">
                      <div className="text-4xl mb-4">👥</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">用户管理</h3>
                      <p className="text-sm text-gray-600">管理员专用</p>
                    </a>
                  )}
                </div>
              </div>
            } />
            <Route path="/m2-verification" element={<M2VerificationPage />} />
            <Route path="/san_1" element={<AuthFlowPage />} />
            <Route path="/m2-verification-3" element={<CampaignListPage />} />
            <Route path="/m2-verification-3/:campaignId" element={<CampaignDetailPage />} />
            <Route path="/user-manager" element={<UserManagerPage />} />
            <Route path="/demo/ancient-modal" element={<AncientModalDemo />} />
            <Route path="/demo/game-intro" element={<GameIntroDemo />} />
          </Routes>
        </main>
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="text-center space-y-2">
              <p className="text-gray-900 font-medium">真三風雲 San Storm - 游戏系统</p>
              <p className="text-sm text-gray-600">版本 0.1.0 - 里程碑2验证模块</p>
              <p className="text-sm text-gray-500">Copyright © 2026 Notee.vip. 保留所有权利</p>
              <p className="text-xs text-gray-400 mt-2">本游戏为原创作品，受版权法保护</p>
            </div>
          </div>
        </footer>

        {/* 管理员登录对话框 */}
        {showLoginDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLoginDialog(false)}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🔒 管理员认证</h3>
              <form onSubmit={handleLogin}>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="请输入管理员密码"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                  autoFocus
                />
                {loginError && (
                  <p className="text-sm text-red-500 mb-3">{loginError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading || !password}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? '验证中...' : '登录'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowLoginDialog(false); setPassword(''); setLoginError(''); }}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;
