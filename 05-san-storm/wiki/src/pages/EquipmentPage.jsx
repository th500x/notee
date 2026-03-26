import React, { useEffect, useState, useMemo } from 'react';
import EquipmentCard from '@shared/components/card/EquipmentCard';
import { loadSharedData } from '@/services/dataService';

/**
 * 装备件列表页面
 * 布局完全仿照 TroopsPage
 */
function EquipmentPage() {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [filters, setFilters]     = useState({
    equipmentType: 'all',
    rarity:        'all',
    search:        '',
  });
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    loadSharedData('equipment')
      .then(data => {
        setEquipment(data.equipment || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('加载装备件数据失败:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const displayed = useMemo(() => {
    let list = [...equipment];

    if (filters.search) {
      list = list.filter(e => e.name.toLowerCase().includes(filters.search.toLowerCase()));
    }
    if (filters.equipmentType !== 'all') {
      list = list.filter(e => e.equipmentType === filters.equipmentType);
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
  }, [equipment, filters, sortOrder]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        <p className="mt-4 text-gray-600">加载装备件列表...</p>
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

  const byType = {
    weapon:    equipment.filter(e => e.equipmentType === 'weapon').length,
    armor:     equipment.filter(e => e.equipmentType === 'armor').length,
    accessory: equipment.filter(e => e.equipmentType === 'accessory').length,
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">装备件系统</h2>

      {/* 统计信息 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{equipment.length}</p>
            <p className="text-sm text-gray-600">总装备件数</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-red-600">{byType.weapon}</p>
            <p className="text-sm text-gray-600">⚔️ 武器</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{byType.armor}</p>
            <p className="text-sm text-gray-600">🛡️ 防具</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">{byType.accessory}</p>
            <p className="text-sm text-gray-600">📖 辅助</p>
          </div>
        </div>
      </div>

      {/* 筛选和排序 */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="搜索装备名称..."
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={filters.equipmentType}
            onChange={e => setFilters({ ...filters, equipmentType: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部类型</option>
            <option value="weapon">⚔️ 武器</option>
            <option value="armor">🛡️ 防具</option>
            <option value="accessory">📖 辅助</option>
          </select>

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
          共找到 <span className="font-medium text-gray-900">{displayed.length}</span> 件装备
        </div>
      </div>

      {/* 卡牌网格 */}
      {displayed.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-500">没有找到符合条件的装备件</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
          {displayed.map(item => (
            <EquipmentCard
              key={item.id}
              equipment={item}
              baseUrl={import.meta.env.BASE_URL}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default EquipmentPage;
