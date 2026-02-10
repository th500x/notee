/**
 * 根组件
 * 
 * @description 应用的根组件，包含路由配置和全局布局
 */

import React, { useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useServers } from '@/hooks/useServers';
import { useFactions } from '@/hooks/useFactions';
import { useCharacters } from '@/hooks/useCharacters';
import { usePositions } from '@/hooks/usePositions';
import { useSkills } from '@/hooks/useSkills';
import { useBonds } from '@/hooks/useBonds';
import { ServerCard } from '@/components/server/ServerCard';
import { FactionCardExample } from '@/components/faction/FactionCardExample';
import { CharacterCard } from '@/components/character/CharacterCard';
import { PositionCard } from '@/components/position/PositionCard';
import { GameDisclaimer } from '@/components/common/GameDisclaimer';
import { LifeStageExample } from '@/components/character/LifeStageExample';
import TroopCardExample from '@/components/troop/TroopCardExample';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* 顶部导航 */}
        <nav className="bg-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  真三风云 <span className="text-sm text-gray-500">San Storm</span>
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <Link 
                  to="/" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  首页
                </Link>
                <Link 
                  to="/servers" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  服务器选择
                </Link>
                <Link 
                  to="/factions" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  势力系统
                </Link>
                <Link 
                  to="/positions" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  官职设定
                </Link>
                <Link 
                  to="/characters" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  角色系统
                </Link>
                <Link 
                  to="/life-stages" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  生涯设定
                </Link>
                <Link 
                  to="/troop-cards" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  部队系统
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* 主内容区 */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/servers" element={<ServersPage />} />
            <Route path="/factions" element={<FactionCardExample />} />
            <Route path="/positions" element={<PositionsPage />} />
            <Route path="/characters" element={<CharactersPage />} />
            <Route path="/life-stages" element={<LifeStageExample />} />
            <Route path="/troop-cards" element={<TroopCardExample />} />
          </Routes>
        </main>

        {/* 页脚 */}
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center space-y-2">
              <p className="text-gray-900 font-medium">
                真三风云 San Storm
              </p>
              <p className="text-sm text-gray-600">
                版本 0.1.0 - 里程碑1核心原型
              </p>
              <p className="text-sm text-gray-500">
                Copyright © 2026 Notee.vip. 保留所有权利
              </p>
              <p className="text-xs text-gray-400 mt-2">
                本游戏为原创作品，受版权法保护
              </p>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

// ==================== 临时页面组件 ====================

function HomePage() {
  return (
    <div className="space-y-8">
      {/* 游戏标题和介绍 */}
      <div className="text-center py-12 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          欢迎来到真三风云
        </h2>
        <p className="text-xl text-gray-600 mb-2">
          三国策略战棋游戏 - 里程碑1核心原型
        </p>
        <p className="text-sm text-gray-500">
          San Storm - 黄巾之乱 S1赛季
        </p>
      </div>

      {/* 功能导航 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <FeatureCard 
          icon="🎮"
          title="服务器选择"
          description="查看服务器状态，选择合适的服务器"
          link="/servers"
        />
        <FeatureCard 
          icon="🏛️"
          title="势力系统"
          description="了解七大势力，选择你的阵营"
          link="/factions"
        />
        <FeatureCard 
          icon="🎖️"
          title="官职设定"
          description="查看官职等级和特权"
          link="/positions"
        />
        <FeatureCard 
          icon="👤"
          title="角色系统"
          description="浏览所有角色，查看详细属性"
          link="/characters"
        />
        <FeatureCard 
          icon="📈"
          title="生涯设定"
          description="查看角色在不同赛季的成长轨迹"
          link="/life-stages"
        />
        <FeatureCard 
          icon="🛡️"
          title="部队系统"
          description="查看所有部队卡牌和属性"
          link="/troop-cards"
        />
      </div>

      {/* 游戏申明 */}
      <GameDisclaimer showFull={true} />

      {/* 版权信息 */}
      <div className="text-center text-sm text-gray-500 py-4">
        <p>真三风云 San Storm © 2026 Notee.vip</p>
        <p className="mt-1">里程碑1 - 核心原型展示</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, link }) {
  return (
    <Link to={link}>
      <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
        <div className="text-4xl mb-4 text-center">{icon}</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">{title}</h3>
        <p className="text-sm text-gray-600 text-center">{description}</p>
      </div>
    </Link>
  );
}

function ServersPage() {
  const { servers, loading, error } = useServers();

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">加载服务器列表...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">❌ 加载失败: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">服务器选择</h2>
      <p className="text-gray-600 mb-6">
        选择一个服务器开始游戏。建议选择空闲或热门状态的服务器。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
        {servers.map(server => (
          <ServerCard 
            key={server.id} 
            server={server}
            onSelect={(server) => alert(`选择了服务器: ${server.name}`)}
          />
        ))}
      </div>
    </div>
  );
}

function CharactersPage() {
  const { characters, loading, error, filterCharacters, sortCharacters } = useCharacters();
  const { skillsMap, loading: skillsLoading } = useSkills();
  const { bondsMap, loading: bondsLoading } = useBonds();
  const [filters, setFilters] = useState({
    season: 'all',
    faction: 'all',
    rarity: 'all',
    stage: 'all',
    search: '',
  });
  const [sortBy, setSortBy] = useState('rarity'); // 默认按稀有度排序
  const [sortOrder, setSortOrder] = useState('desc'); // 默认降序

  // 应用筛选和排序
  const displayedCharacters = useMemo(() => {
    const filtered = filterCharacters(filters);
    return sortCharacters(filtered, sortBy, sortOrder);
  }, [characters, filters, sortBy, sortOrder, filterCharacters, sortCharacters]);

  if (loading || skillsLoading || bondsLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">加载武将列表...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">❌ 加载失败: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">武将列表</h2>
      
      {/* 筛选和排序控制 */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 搜索 */}
          <input
            type="text"
            placeholder="搜索武将名字..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          {/* 赛季筛选 */}
          <select
            value={filters.season}
            onChange={(e) => setFilters({ ...filters, season: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部赛季</option>
            <option value="S1">S1 黄巾之乱</option>
            <option value="S2">S2 董卓之乱</option>
            <option value="S3">S3 群雄割据</option>
          </select>
          
          {/* 势力筛选 */}
          <select
            value={filters.faction}
            onChange={(e) => setFilters({ ...filters, faction: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部势力</option>
            <option value="通用">通用</option>
            <option value="刘备">刘备</option>
            <option value="曹操">曹操</option>
            <option value="孙坚">孙坚</option>
            <option value="袁绍">袁绍</option>
            <option value="董卓">董卓</option>
            <option value="汉室">汉室</option>
            <option value="黄巾">黄巾</option>
          </select>
          
          {/* 稀有度筛选 */}
          <select
            value={filters.rarity}
            onChange={(e) => setFilters({ ...filters, rarity: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部稀有度</option>
            <option value="common">普通</option>
            <option value="rare">稀有</option>
            <option value="epic">史诗</option>
            <option value="legendary">传奇</option>
            <option value="core">核心</option>
          </select>
          
          {/* 排序方向 */}
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
          >
            {sortOrder === 'asc' ? '↑ 升序' : '↓ 降序'}
          </button>
        </div>
        
        {/* 结果统计 */}
        <div className="mt-3 text-sm text-gray-600">
          共找到 <span className="font-medium text-gray-900">{displayedCharacters.length}</span> 位武将
        </div>
      </div>

      {/* 武将卡片网格 */}
      {displayedCharacters.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-500">没有找到符合条件的武将</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
          {displayedCharacters.map(character => (
            <CharacterCard 
              key={character.id} 
              character={character}
              skillsMap={skillsMap}
              bondsMap={bondsMap}
              onSelect={(char) => alert(`选择了武将: ${char.name}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PositionsPage() {
  const { positions, loading, error } = usePositions();

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">加载官职列表...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600">❌ 加载失败: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">官职系统</h2>
      <p className="text-gray-600 mb-6">
        官职系统共分为9个等级，从军候到大将军。官职越高，获得的加成和特殊权限越多。
        5级及以上官职每个势力唯一，需要通过竞争获得。
      </p>
      
      {/* 官职统计 */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{positions.length}</p>
            <p className="text-sm text-gray-600">官职总数</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">
              {positions.filter(p => p.level === 9).length}
            </p>
            <p className="text-sm text-gray-600">AI专属（9级）</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600">
              {positions.filter(p => p.level >= 5 && p.level <= 8).length}
            </p>
            <p className="text-sm text-gray-600">高级官职（5-8级）</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {positions.filter(p => p.level >= 1 && p.level <= 4).length}
            </p>
            <p className="text-sm text-gray-600">基础官职（1-4级）</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-600">5</p>
            <p className="text-sm text-gray-600">部队卡等级</p>
          </div>
        </div>
      </div>

      {/* 官职卡牌网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
        {positions.map(position => (
          <PositionCard
            key={position.id}
            position={position}
            onSelect={(pos) => {
              alert(`选择了官职: ${pos.name}\n等级: ${pos.level}\n排名: #${pos.rank}`);
            }}
          />
        ))}
      </div>

      {/* 设计说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
        <h3 className="text-base font-semibold text-blue-900 mb-3">设计说明</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>• <strong>卡牌尺寸：</strong>256 × 384 px (2:3比例)</p>
          <p>• <strong>等级配色：</strong>9级红色（AI专属）→ 8级橙色（最高级）→ 7级黄色（高级）→ 低级灰色</p>
          <p>• <strong>信息展示：</strong>官职名称、等级、排名、加成效果、特殊权限、晋升要求</p>
          <p>• <strong>交互效果：</strong>悬停放大、点击选择</p>
          <p>• <strong>视觉风格：</strong>与部队卡牌、服务器卡牌保持一致的暗色系风格</p>
        </div>
      </div>
    </div>
  );
}

export default App;
