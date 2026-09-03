import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ErrorBoundary from '@shared/components/common/ErrorBoundary';
import HomePage from '@/pages/HomePage';
import CharactersPage from '@/pages/CharactersPage';
import PositionsPage from '@/pages/PositionsPage';
import San1Page from '@/pages/San1Page';
import FactionsPage from '@/pages/FactionsPage';
import TroopsPage from '@/pages/TroopsPage';
import EquipmentPage from '@/pages/EquipmentPage';
import TitlesAchievementsPage from '@/pages/TitlesAchievementsPage';

function App() {
  return (
    <Router basename="/33-san-storm/wiki">
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex justify-between items-center">
              <div>
                <a 
                  href="/33-san-storm/"
                  className="text-3xl font-bold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer relative group inline-block"
                >
                  真三風雲 - 资料库
                  <span className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    返回主页
                  </span>
                </a>
                <p className="text-gray-600 mt-2">三国策略战棋游戏 - 游戏资料展示</p>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/san_1" element={<San1Page />} />
              <Route path="/factions" element={<FactionsPage />} />
              <Route path="/positions" element={<PositionsPage />} />
              <Route path="/characters" element={<CharactersPage />} />
              <Route path="/troops" element={<TroopsPage />} />
              <Route path="/equipment" element={<EquipmentPage />} />
              <Route path="/titles-achievements" element={<TitlesAchievementsPage />} />
            </Routes>
          </ErrorBoundary>
        </main>
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="text-center space-y-2">
              <p className="text-gray-900 font-medium">真三風雲 San Storm - 资料库</p>
              <p className="text-sm text-gray-600">版本 0.1.0 - 游戏资料展示</p>
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
