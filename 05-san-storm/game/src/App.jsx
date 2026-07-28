import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ErrorBoundary from '@shared/components/common/ErrorBoundary';
import { useAdmin } from '@/hooks/useAdmin';
import { isAdminDevBypassAllowed } from '@/utils/adminDevBypass';
import AdminEnvQueryToggle from '@/components/admin/AdminEnvQueryToggle';
import { weeklyReportCard } from '@/data/texts/weeklyReport';

const AuthFlowPage = lazy(() => import('@/pages/AuthFlowPage'));
const WeeklyReportPage = lazy(() => import('@/pages/WeeklyReportPage'));
const UserManagerPage = lazy(() => import('@/pages/admin/UserManagerPage'));
const MailManagerPage = lazy(() => import('@/pages/admin/MailManagerPage'));
const ActivityManagerPage = lazy(() => import('@/pages/admin/ActivityManagerPage'));
const CampaignMapGeneratorManagerPage = lazy(() => import('@/pages/admin/CampaignMapGeneratorManagerPage'));
const PvpDuelMapGeneratorManagerPage = lazy(() => import('@/pages/admin/PvpDuelMapGeneratorManagerPage'));
const JunStrategicMapWorkshopPage = lazy(() => import('@/pages/admin/JunStrategicMapWorkshopPage'));
const AdminEnvTogglePage = lazy(() => import('@/pages/admin/AdminEnvTogglePage'));
const SeasonRolloverManagerPage = lazy(() => import('@/pages/admin/SeasonRolloverManagerPage'));
const ChapterStageDebugPage = lazy(() => import('@/pages/admin/ChapterStageDebugPage'));

function RouteLoading() {
  return (
    <div className="flex justify-center items-center py-24">
      <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      <span className="sr-only">加载中</span>
    </div>
  );
}

function App() {
  const { isLoggedIn, devBypass, toggleDevBypass } = useAdmin();

  return (
    <Router
      basename="/05-san-storm/game"
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AdminEnvQueryToggle />
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
                    <a href={`${import.meta.env.BASE_URL}chapter-stage-debug`} className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col border-2 border-lime-200">
                      <div className="text-4xl mb-4 text-center">♟️</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">章节生图调试</h3>
                      <p className="text-sm text-gray-600 text-center">可变尺寸 · 草稿关卡 · LargeMapBattle</p>
                    </a>
                    <a href={`${import.meta.env.BASE_URL}pvp-duel-map-manager`} className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col border-2 border-rose-200">
                      <div className="text-4xl mb-4 text-center">⚔️</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">对决地图</h3>
                      <p className="text-sm text-gray-600 text-center">8×10 · rule_profile · 固化 JSON</p>
                    </a>
                    <a href={`${import.meta.env.BASE_URL}jun-strategic-map-workshop`} className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col border-2 border-teal-200">
                      <div className="text-4xl mb-4 text-center">🛠️</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">郡战略图工坊</h3>
                      <p className="text-sm text-gray-600 text-center">Meowa · 城/战场点选 · 道路 · 保存 merged</p>
                    </a>
                    <a href={`${import.meta.env.BASE_URL}season-rollover-manager`} className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col border-2 border-orange-300">
                      <div className="text-4xl mb-4 text-center">🏛️</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">赛季管理</h3>
                      <p className="text-sm text-gray-600 text-center">结算窗口 · 维护态 · 关服切换 rollover</p>
                    </a>
                    <button
                      type="button"
                      disabled={!isAdminDevBypassAllowed}
                      onClick={isAdminDevBypassAllowed ? toggleDevBypass : undefined}
                      className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow h-full flex flex-col border-2 border-violet-200 text-left w-full disabled:opacity-70 disabled:cursor-default"
                      title={
                        isAdminDevBypassAllowed
                          ? undefined
                          : '生产构建不可切换开发 bypass；本地请用 npm run dev'
                      }
                    >
                      <div className="text-4xl mb-4 text-center">{devBypass ? '🛠️' : '🏭'}</div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
                        {devBypass ? '开发环境' : '生产环境'}
                      </h3>
                      <p className="text-sm text-gray-600 text-center">
                        {isAdminDevBypassAllowed
                          ? devBypass
                            ? '已跳过管理员登录；点击切换为生产环境'
                            : '当前为生产模式；点击切换为开发环境'
                          : '当前为生产构建；须主站管理员 JWT；本地 dev 服可切换 bypass'}
                      </p>
                    </button>
                    </>
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
            <Route path="/chapter-stage-debug" element={<ChapterStageDebugPage />} />
            <Route path="/pvp-duel-map-manager" element={<PvpDuelMapGeneratorManagerPage />} />
            <Route path="/jun-strategic-map-workshop" element={<JunStrategicMapWorkshopPage />} />
            <Route path="/admin-env-toggle" element={<AdminEnvTogglePage />} />
            <Route path="/season-rollover-manager" element={<SeasonRolloverManagerPage />} />

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
      </div>
    </Router>
  );
}

export default App;
