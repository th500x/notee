import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import M2VerificationPage from '@/pages/M2VerificationPage';
import M2Verification2Page from '@/pages/M2Verification2Page';
import UserManagerPage from '@/pages/UserManagerPage';
import ServersPage from '@/pages/ServersPage';
import CampaignDisplay from '@/components/campaign/CampaignDisplay';
import CampaignList from '@/components/campaign/CampaignList';

function App() {
  return (
    <Router basename="/05-san-storm/game">
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex justify-between items-center">
              <div>
                <a 
                  href="/"
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
                  <a href={`${import.meta.env.BASE_URL}servers`} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                    <div className="text-4xl mb-4">🎮</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">服务器选择</h3>
                    <p className="text-sm text-gray-600">选择游戏服务器</p>
                  </a>
                  <a href={`${import.meta.env.BASE_URL}m2-verification`} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                    <div className="text-4xl mb-4">⚔️</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">部队编组</h3>
                    <p className="text-sm text-gray-600">M2验证模块-1</p>
                  </a>
                  <a href={`${import.meta.env.BASE_URL}m2-verification-2`} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                    <div className="text-4xl mb-4">🎯</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">用户注册</h3>
                    <p className="text-sm text-gray-600">M2验证模块-2</p>
                  </a>
                  <a href={`${import.meta.env.BASE_URL}m2-verification-3`} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                    <div className="text-4xl mb-4">🗺️</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">战役地图</h3>
                    <p className="text-sm text-gray-600">M2验证模块-3</p>
                  </a>
                  <a href={`${import.meta.env.BASE_URL}user-manager`} className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border-2 border-red-300">
                    <div className="text-4xl mb-4">👥</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">用户管理</h3>
                    <p className="text-sm text-gray-600">管理员专用</p>
                  </a>
                </div>
              </div>
            } />
            <Route path="/servers" element={<ServersPage />} />
            <Route path="/m2-verification" element={<M2VerificationPage />} />
            <Route path="/m2-verification-2" element={<M2Verification2Page />} />
            <Route path="/m2-verification-3" element={<CampaignList />} />
            <Route path="/m2-verification-3/:campaignId" element={<CampaignDisplay />} />
            <Route path="/user-manager" element={<UserManagerPage />} />
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
      </div>
    </Router>
  );
}

export default App;
