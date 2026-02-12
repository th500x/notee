/**
 * 根组件
 * 
 * @description 应用的根组件，包含路由配置和全局布局
 */

import React, { useState, useMemo, useEffect } from 'react';
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
import TroopFormationSystem from '@/components/formation/TroopFormationSystem';
import GameAuthSystem from '@/components/auth/GameAuthSystem';
import UserManager from '@/components/admin/UserManager';
import AdminSetup from '@/components/admin/AdminSetup';
import { hasAdminAccess } from '@/utils/adminAuth';

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // 检查管理员权限
  useEffect(() => {
    const checkAdminStatus = () => {
      setIsAdminUser(hasAdminAccess());
    };
    
    checkAdminStatus();
    
    // 监听localStorage变化（用户登录/退出时更新权限）
    const handleStorageChange = () => {
      checkAdminStatus();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // 定期检查权限状态（防止localStorage在同一标签页中变化）
    const interval = setInterval(checkAdminStatus, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return (
    <Router basename="/05-san-storm">
      <div className="min-h-screen bg-gray-50">
        {/* 顶部导航 */}
        <nav className="bg-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              {/* Logo */}
              <div className="flex items-center">
                <a 
                  href="/"
                  className="text-xl sm:text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer relative group"
                >
                  真三风云 <span className="text-xs sm:text-sm text-gray-500">San Storm</span>
                  {/* 悬停提示 - 改为显示在下方 */}
                  <span className="absolute top-full left-0 mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    返回主页
                  </span>
                </a>
              </div>

              {/* 桌面端导航 */}
              <div className="hidden lg:flex items-center space-x-4">
                <Link 
                  to="/" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
                >
                  首页
                </Link>
                <Link 
                  to="/servers" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
                >
                  服务器选择
                </Link>
                <Link 
                  to="/factions" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
                >
                  势力系统
                </Link>
                <Link 
                  to="/positions" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
                >
                  官职设定
                </Link>
                <Link 
                  to="/characters" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
                >
                  角色系统
                </Link>
                <Link 
                  to="/life-stages" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
                >
                  生涯设定
                </Link>
                <Link 
                  to="/troop-cards" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
                >
                  部队系统
                </Link>
                <Link 
                  to="/m2-verification" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
                >
                  M2验证模块
                </Link>
                <Link 
                  to="/m2-verification-2" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
                >
                  M2验证模块-2
                </Link>
                {isAdminUser && (
                  <Link 
                    to="/user-manager" 
                    className="text-red-700 hover:text-red-900 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap border border-red-300 rounded-md bg-red-50"
                    title="管理员专用"
                  >
                    👥 用户管理
                  </Link>
                )}
              </div>

              {/* 移动端菜单按钮 */}
              <div className="flex items-center lg:hidden">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
                >
                  <span className="sr-only">打开菜单</span>
                  {mobileMenuOpen ? (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 移动端菜单 */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-gray-200">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <Link 
                  to="/" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-base font-medium"
                >
                  首页
                </Link>
                <Link 
                  to="/servers" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-base font-medium"
                >
                  服务器选择
                </Link>
                <Link 
                  to="/factions" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-base font-medium"
                >
                  势力系统
                </Link>
                <Link 
                  to="/positions" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-base font-medium"
                >
                  官职设定
                </Link>
                <Link 
                  to="/characters" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-base font-medium"
                >
                  角色系统
                </Link>
                <Link 
                  to="/life-stages" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-base font-medium"
                >
                  生涯设定
                </Link>
                <Link 
                  to="/troop-cards" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-base font-medium"
                >
                  部队系统
                </Link>
                <Link 
                  to="/m2-verification" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-base font-medium"
                >
                  M2验证模块
                </Link>
                <Link 
                  to="/m2-verification-2" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-base font-medium"
                >
                  M2验证模块-2
                </Link>
                {isAdminUser && (
                  <Link 
                    to="/user-manager" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-red-700 hover:text-red-900 hover:bg-red-50 px-3 py-2 rounded-md text-base font-medium border border-red-300 mx-3 my-1"
                    title="管理员专用"
                  >
                    👥 用户管理
                  </Link>
                )}
              </div>
            </div>
          )}
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
            <Route path="/m2-verification" element={<M2VerificationPage />} />
            <Route path="/m2-verification-2" element={<M2Verification2Page />} />
            <Route path="/user-manager" element={<UserManagerPage />} />
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
  const [isAdminUser, setIsAdminUser] = useState(false);

  // 检查管理员权限（基于机器指纹）
  useEffect(() => {
    const checkAdminStatus = () => {
      setIsAdminUser(hasAdminAccess());
    };
    
    checkAdminStatus();
    
    // 定期检查权限状态（每5秒检查一次，避免过于频繁）
    const interval = setInterval(checkAdminStatus, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

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
        <FeatureCard 
          icon="⚔️"
          title="M2验证模块"
          description="部队编组系统验证测试"
          link="/m2-verification"
        />
        <FeatureCard 
          icon="🎮"
          title="M2验证模块-2"
          description="游戏注册登录系统验证"
          link="/m2-verification-2"
        />
        {isAdminUser && (
          <FeatureCard 
            icon="👥"
            title="用户管理"
            description="查看和管理已注册用户（管理员专用）"
            link="/user-manager"
            className="border-red-300 bg-red-50"
          />
        )}
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

function FeatureCard({ icon, title, description, link, className = "" }) {
  return (
    <Link to={link}>
      <div className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col ${className}`}>
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

function M2VerificationPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">M2验证模块</h2>
        <p className="text-gray-600">
          里程碑2核心功能验证 - 部队编组系统测试
        </p>
      </div>
      
      {/* 功能说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">功能特性</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 武将 + 部队卡组合机制</li>
          <li>• 实时战力计算（组合加成10%）</li>
          <li>• 最多支持6个编组</li>
          <li>• 一键自动编组功能</li>
          <li>• 使用emoji临时占位符图标</li>
        </ul>
      </div>

      <TroopFormationSystem />
    </div>
  );
}

function M2Verification2Page() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">M2验证模块-2</h2>
        <p className="text-gray-600">
          游戏注册登录系统验证测试
        </p>
      </div>
      
      {/* 功能说明 */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-green-900 mb-2">系统特性</h3>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• 4位随机ID注册系统（36^4 = 167万+组合）</li>
          <li>• 防重复注册（基于机器指纹和IP）</li>
          <li>• 简化注册流程（无需手机/邮箱）</li>
          <li>• 服务器选择集成</li>
          <li>• 本地存储模拟数据库</li>
        </ul>
      </div>

      <GameAuthSystem />
    </div>
  );
}

// 用户管理页面（受保护）
function UserManagerPage() {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const adminAccess = hasAdminAccess();
  
  // 全局密码验证（优先使用环境变量）
  const GLOBAL_ADMIN_PASSWORD = process.env.REACT_APP_GLOBAL_ADMIN_PASSWORD || 'notee.vip.2026';
  
  const verifyPassword = () => {
    if (passwordInput === GLOBAL_ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setShowPasswordModal(false);
      setPasswordInput('');
      setPasswordError('');
    } else {
      setPasswordError('密码错误，请重试');
    }
  };
  
  const handlePasswordCancel = () => {
    setShowPasswordModal(false);
    setPasswordInput('');
    setPasswordError('');
  };
  
  // 如果没有管理员权限，显示无权限页面
  if (!adminAccess) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">访问被拒绝</h2>
          <p className="text-gray-600 mb-6">
            此页面仅限管理员访问。如果您是管理员，请先登录管理员账号。
          </p>
          <Link 
            to="/" 
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }
  
  // 如果有管理员权限但未通过密码验证，显示密码输入
  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">管理员验证</h2>
          <p className="text-gray-600 mb-6">请输入管理员密码以访问用户管理功能</p>
          
          <div className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && verifyPassword()}
              placeholder="请输入管理员密码"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {passwordError && (
              <p className="text-red-600 text-sm">{passwordError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={verifyPassword}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                验证
              </button>
              <Link
                to="/"
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-center"
              >
                返回
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <span className="text-red-600">🔒</span>
          <span className="text-red-800 font-medium">管理员模式</span>
          <span className="text-red-600 text-sm">
            - 当前环境: {process.env.NODE_ENV === 'development' ? '开发环境' : '生产环境'}
          </span>
        </div>
      </div>
      
      <AdminSetup />
      <UserManager />
    </div>
  );
}

export default App;
