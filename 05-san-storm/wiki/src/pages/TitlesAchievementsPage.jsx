import React, { useEffect, useState, useMemo } from 'react';
import TitleAchievementCard from '@shared/components/card/TitleAchievementCard';
import { loadSharedData } from '@/services/dataService';

/**
 * 称号/成就列表页面
 * 布局完全仿照 EquipmentPage，增加称号/成就切换
 */
function TitlesAchievementsPage() {
  const [titles, setTitles]             = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [activeTab, setActiveTab]       = useState('title');
  const [filters, setFilters]           = useState({
    rarity: 'all',
    search: '',
  });
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    Promise.all([
      loadSharedData('titles'),
      loadSharedData('achievements'),
    ])
      .then(([titlesData, achievementsData]) => {
        setTitles(titlesData.titles || []);
        setAchievements(achievementsData.achievements || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('加载称号/成就数据失败:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const currentList = activeTab === 'title' ? titles : achievements;

  const displayed = useMemo(() => {
    let list = [...currentList];

    if (filters.search) {
      list = list.filter(e => e.name.toLowerCase().includes(filters.search.toLowerCase()));
    }
    if (filters.rarity !== 'all') {
      list = list.filter(e => e.rarity === filters.rarity);
    }

    const rarityOrder = { common: 1, rare: 2, epic: 3, legendary: 4, core: 5 };
    list.sort((a, b) => {
      const diff = rarityOrder[b.rarity] - rarityOrder[a.rarity];
      return sortOrder === 'desc' ? diff : -diff;
    });

    return list;
  }, [currentList, filters, sortOrder]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        <p className="mt-4 text-gray-600">加载称号/成就列表...</p>
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

  const tabLabel = activeTab === 'title' ? '称号' : '成就';

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">称号/成就系统</h2>

      {/* 切换按钮 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setActiveTab('title'); setFilters({ rarity: 'all', search: '' }); }}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'title'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🏆 称号 ({titles.length})
        </button>
        <button
          onClick={() => { setActiveTab('achievement'); setFilters({ rarity: 'all', search: '' }); }}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'achievement'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🎖️ 成就 ({achievements.length})
        </button>
      </div>

      {/* 统计信息 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{currentList.length}</p>
            <p className="text-sm text-gray-600">总{tabLabel}数</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-500">{currentList.filter(e => e.rarity === 'common').length}</p>
            <p className="text-sm text-gray-600">普通</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{currentList.filter(e => e.rarity === 'rare').length}</p>
            <p className="text-sm text-gray-600">稀有</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">{currentList.filter(e => e.rarity === 'epic').length}</p>
            <p className="text-sm text-gray-600">史诗</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-yellow-600">{currentList.filter(e => e.rarity === 'legendary' || e.rarity === 'core').length}</p>
            <p className="text-sm text-gray-600">传奇/核心</p>
          </div>
        </div>
      </div>

      {/* 筛选和排序 */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder={`搜索${tabLabel}名称...`}
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={filters.rarity}
            onChange={e => setFilters({ ...filters, rarity: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部稀有度</option>
            <option value="common">普通</option>
            <option value="rare">稀有</option>
            <option value="epic">史诗</option>
            <option value="legendary">传奇</option>
            <option value="core">核心</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
          >
            {sortOrder === 'asc' ? '↑ 升序' : '↓ 降序'}
          </button>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          共找到 <span className="font-medium text-gray-900">{displayed.length}</span> 个{tabLabel}
        </div>
      </div>

      {/* 卡牌网格 */}
      {displayed.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-500">没有找到符合条件的{tabLabel}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
          {displayed.map(item => (
            <TitleAchievementCard
              key={item.id}
              item={item}
              type={activeTab}
              baseUrl={import.meta.env.BASE_URL}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default TitlesAchievementsPage;
