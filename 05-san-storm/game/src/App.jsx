import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, lazy, Suspense } from 'react';
import ErrorBoundary from '@shared/components/common/ErrorBoundary';
import { useAdmin } from '@/hooks/useAdmin';
import { weeklyReportCard } from '@/data/texts/weeklyReport';

const AuthFlowPage = lazy(() => import('@/pages/AuthFlowPage'));
const WeeklyReportPage = lazy(() => import('@/pages/WeeklyReportPage'));
const UserManagerPage = lazy(() => import('@/pages/admin/UserManagerPage'));
const MailManagerPage = lazy(() => import('@/pages/admin/MailManagerPage'));
const ActivityManagerPage = lazy(() => import('@/pages/admin/ActivityManagerPage'));
const CampaignMapGeneratorManagerPage = lazy(() => import('@/pages/admin/CampaignMapGeneratorManagerPage'));
const JunCountyMapGeneratorManagerPage = lazy(() => import('@/pages/admin/JunCountyMapGeneratorManagerPage'));
const BattleAnimationDemoPage = lazy(() => import('@/pages/BattleAnimationDemoPage'));

function RouteLoading() {
  return (
    <div className="flex justify-center items-center py-24">
      <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      <span className="sr-only">加载中</span>
    </div>
  );
}

function App() {
  const { isLoggedIn, loading, login, logout, devBypass, toggleDevBypass } = useAdmin();
  
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
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <ErrorBoundary>
          <Suspense fallback={<RouteLoading />}>
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
                  <a href={`${import.meta.env.BASE_URL}san_1`} className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
                    <div className="text-4xl mb-4 text-center">🎯</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">[黄巾之乱]</h3>
                    <p className="text-sm text-gray-600 text-center">真三风云 - 赛季1</p>
                  </a>

                  <a href={`${import.meta.env.BASE_URL}weekly-report`} className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col border border-purple-100">
                    <div className="text-4xl mb-4 text-center">{weeklyReportCard.emoji}</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">{weeklyReportCard.title}</h3>
                    <p className="text-sm text-gray-600 text-center">{weeklyReportCard.description}</p>
                  </a>

                  <a href={`${import.meta.env.BASE_URL}battle-animation-demo`} className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col border border-amber-100">
                    <div className="text-4xl mb-4 text-center">🎬</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">战斗动画 Demo</h3>
                    <p className="text-sm text-gray-600 text-center">引擎 play*Demo · 占位地图与兵力（开发调试用）</p>
                  </a>

                  {isLoggedIn && (
                    <>
                    <a href={`${import.meta.env.BASE_URL}user-manager`} className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col border-2 border-red-300">
                      <div className="text-4xl mb-4 text-center">👥</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">用户管理</h3>
                      <p className="text-sm text-gray-600 text-center">管理员专用</p>
                    </a>
                    <a href={`${import.meta.env.BASE_URL}mail-manager`} className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col border-2 border-amber-200">
                      <div className="text-4xl mb-4 text-center">✉️</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">传书模板</h3>
                      <p className="text-sm text-gray-600 text-center">config_texts · 试发</p>
                    </a>
                    <a href={`${import.meta.env.BASE_URL}activity-manager`} className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col border-2 border-emerald-200">
                      <div className="text-4xl mb-4 text-center">🏆</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">活动管理</h3>
                      <p className="text-sm text-gray-600 text-center">排行榜归档 · Top30</p>
                    </a>
                    <a href={`${import.meta.env.BASE_URL}campaign-map-manager`} className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col border-2 border-amber-200">
                      <div className="text-4xl mb-4 text-center">🗺️</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">战役地图</h3>
                      <p className="text-sm text-gray-600 text-center">preset · 随机 seed · 固化 JSON</p>
                    </a>
                    <a href={`${import.meta.env.BASE_URL}three-kingdoms-map`} className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col border-2 border-sky-200">
                      <div className="text-4xl mb-4 text-center">🧭</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">三国地图</h3>
                      <p className="text-sm text-gray-600 text-center">郡象限 · 颍川 A · 底板与城点（测试）</p>
                    </a>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={toggleDevBypass}
                    className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col border-2 border-violet-200 text-left w-full"
                  >
                    <div className="text-4xl mb-4 text-center">{devBypass ? '🛠️' : '🏭'}</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
                      {devBypass ? '开发环境' : '生产环境'}
                    </h3>
                    <p className="text-sm text-gray-600 text-center">
                      {devBypass
                        ? '已跳过管理员登录；点击切换为生产环境'
                        : '管理员卡片须登录；点击切换为开发环境'}
                    </p>
                  </button>

                  {!isLoggedIn && (
                    <button
                      type="button"
                      onClick={() => setShowLoginDialog(true)}
                      className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col border-2 border-slate-300 text-left w-full"
                    >
                      <div className="text-4xl mb-4 text-center">🔒</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">管理员登录</h3>
                      <p className="text-sm text-gray-600 text-center">输入密码后显示管理员功能卡片</p>
                    </button>
                  )}
                </div>
              </div>
            } />
            <Route path="/san_1" element={<AuthFlowPage />} />
            <Route path="/san_1/game" element={<AuthFlowPage />} />
            <Route path="/weekly-report" element={<WeeklyReportPage />} />
            <Route path="/user-manager" element={<UserManagerPage />} />
            <Route path="/mail-manager" element={<MailManagerPage />} />
            <Route path="/activity-manager" element={<ActivityManagerPage />} />
            <Route path="/campaign-map-demo" element={<Navigate to="/campaign-map-manager" replace />} />
            <Route path="/campaign-map-manager" element={<CampaignMapGeneratorManagerPage />} />
            <Route path="/three-kingdoms-map" element={<JunCountyMapGeneratorManagerPage />} />
            <Route path="/battle-animation-demo" element={<BattleAnimationDemoPage />} />

          </Routes>
          </Suspense>
          </ErrorBoundary>
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
