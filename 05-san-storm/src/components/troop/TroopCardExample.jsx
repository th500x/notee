import React, { useEffect, useState, useMemo } from 'react';
import TroopCard from './TroopCard';
import { loadSharedData } from '@/utils/dataLoader';

/**
 * 根据部队ID推断势力
 * @param {string} troopId - 部队ID (如 troop_san_1101)
 * @returns {string} 势力名称
 */
const getFactionFromTroopId = (troopId) => {
  // 提取ID中的前两位数字来判断势力
  // troop_san_1101 -> 11 -> 刘备
  // troop_san_1001 -> 10 -> 通用
  const match = troopId.match(/troop_san_(\d{2})/);
  if (!match) return '通用';
  
  const factionCode = match[1];
  const factionMap = {
    '10': '通用',  // 通用部队
    '11': '刘备',  // 幽州
    '12': '曹操',  // 兖州
    '13': '孙坚',  // 徐州
    '14': '袁绍',  // 冀州
    '15': '董卓',  // 并州
    '16': '汉室',  // 司隶
    '17': '黄巾',  // 黄巾
    '18': '其他',  // 其他势力（凉州等）
  };
  
  return factionMap[factionCode] || '通用';
};

/**
 * 部队卡牌示例页面
 * 用于展示和测试部队卡牌组件
 */
const TroopCardExample = () => {
  const [troops, setTroops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    faction: 'all',
    troopType: 'all',
    rarity: 'all',
    search: '',
  });
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    // 加载部队数据
    loadSharedData('troops')
      .then(data => {
        // 为每个部队添加faction字段
        const troopsWithFaction = (data.troops || []).map(troop => ({
          ...troop,
          faction: getFactionFromTroopId(troop.id)
        }));
        setTroops(troopsWithFaction);
        setLoading(false);
      })
      .catch(err => {
        console.error('加载部队数据失败:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // 应用筛选和排序
  const displayedTroops = useMemo(() => {
    let filtered = [...troops];

    // 搜索过滤
    if (filters.search) {
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // 势力过滤
    if (filters.faction !== 'all') {
      filtered = filtered.filter(t => t.faction === filters.faction);
    }

    // 兵种过滤
    if (filters.troopType !== 'all') {
      filtered = filtered.filter(t => t.troopType === filters.troopType);
    }

    // 稀有度过滤
    if (filters.rarity !== 'all') {
      filtered = filtered.filter(t => t.rarity === filters.rarity);
    }

    // 排序
    filtered.sort((a, b) => {
      const rarityOrder = { common: 1, rare: 2, epic: 3, legendary: 4, core: 5 };
      const diff = rarityOrder[b.rarity] - rarityOrder[a.rarity];
      return sortOrder === 'desc' ? diff : -diff;
    });

    return filtered;
  }, [troops, filters, sortOrder]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">加载部队列表...</p>
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

  // 按兵种统计
  const troopsByType = {
    infantry: troops.filter(t => t.troopType === 'infantry').length,
    cavalry: troops.filter(t => t.troopType === 'cavalry').length,
    archer: troops.filter(t => t.troopType === 'archer').length
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">部队列表</h2>
      
      {/* 统计信息 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{troops.length}</p>
            <p className="text-sm text-gray-600">总部队数</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{troopsByType.infantry}</p>
            <p className="text-sm text-gray-600">🛡️ 步兵</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-red-600">{troopsByType.cavalry}</p>
            <p className="text-sm text-gray-600">🐎 骑兵</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{troopsByType.archer}</p>
            <p className="text-sm text-gray-600">🏹 弓兵</p>
          </div>
        </div>
      </div>

      {/* 筛选和排序控制 */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 搜索 */}
          <input
            type="text"
            placeholder="搜索部队名称..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
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
          
          {/* 兵种筛选 */}
          <select
            value={filters.troopType}
            onChange={(e) => setFilters({ ...filters, troopType: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部兵种</option>
            <option value="infantry">🛡️ 步兵</option>
            <option value="cavalry">🐎 骑兵</option>
            <option value="archer">🏹 弓兵</option>
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
          共找到 <span className="font-medium text-gray-900">{displayedTroops.length}</span> 支部队
        </div>
      </div>

      {/* 部队卡片网格 */}
      {displayedTroops.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-500">没有找到符合条件的部队</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
          {displayedTroops.map(troop => (
            <TroopCard key={troop.id} troop={troop} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TroopCardExample;
