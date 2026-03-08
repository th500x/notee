/**
 * 生涯示例页面
 * 
 * @description 展示如何使用生涯详情组件
 * @module components/character/LifeStageExample
 */

import { useState, useMemo } from 'react';
import { useCharacters } from '../../hooks/useCharacters';
import { useLifeStages } from '../../hooks/useLifeStages';
import { LifeStageDetail, LifeStageCard } from './LifeStageDetail';

/**
 * 生涯示例页面
 */
export function LifeStageExample() {
  const { characters, loading: charactersLoading, filterCharacters, sortCharacters } = useCharacters();
  const { lifeStages, loading: lifeStagesLoading, getCharacterLifeStage } = useLifeStages();
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  
  // 筛选和排序状态
  const [filters, setFilters] = useState({
    season: 'san_1', // 默认显示san_1
    faction: 'all',
    rarity: 'all',
    stage: 'all',
    search: '',
  });
  const [sortBy, setSortBy] = useState('rarity'); // 默认按稀有度排序
  const [sortOrder, setSortOrder] = useState('desc'); // 默认降序

  const loading = charactersLoading || lifeStagesLoading;

  // 应用筛选和排序
  const displayedCharacters = useMemo(() => {
    const filtered = filterCharacters(filters);
    return sortCharacters(filtered, sortBy, sortOrder);
  }, [characters, filters, sortBy, sortOrder, filterCharacters, sortCharacters]);

  // 获取当前赛季的生涯数据
  const getSeasonData = (characterId) => {
    const lifeStageData = getCharacterLifeStage(characterId);
    if (!lifeStageData || !lifeStageData.seasons) return null;
    
    // 如果选择了特定赛季，返回该赛季数据
    if (filters.season !== 'all') {
      return lifeStageData.seasons.find(s => s.season === filters.season);
    }
    
    // 否则返回第一个赛季（S1）
    return lifeStageData.seasons[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            生涯系统
          </h1>
          <p className="text-gray-600">
            查看武将在不同赛季的生涯变化，点击卡牌查看完整生涯详情
          </p>
        </div>

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
              <option value="san_1">san_1 黄巾之乱</option>
              <option value="san_2">san_2 董卓之乱</option>
              <option value="san_3">san_3 群雄割据</option>
              <option value="S4">S4 官渡之战</option>
              <option value="S5">S5 三顾茅庐</option>
              <option value="S6">S6 赤壁之战</option>
              <option value="S7">S7 三分天下</option>
              <option value="S8">S8 夷陵之战</option>
              <option value="S9">S9 出师北伐</option>
            </select>
            
            {/* 势力筛选 */}
            <select
              value={filters.faction}
              onChange={(e) => setFilters({ ...filters, faction: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部势力</option>
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

        {/* 生涯卡片网格 */}
        {displayedCharacters.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500">没有找到符合条件的武将</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedCharacters.map(character => {
              const seasonData = getSeasonData(character.id);
              const lifeStageData = getCharacterLifeStage(character.id);

              return seasonData && lifeStageData ? (
                <div
                  key={character.id}
                  onClick={() => setSelectedCharacter(lifeStageData)}
                  className="cursor-pointer"
                >
                  <LifeStageCard
                    seasonData={seasonData}
                    characterName={character.name}
                    allSeasons={lifeStageData.seasons}
                  />
                </div>
              ) : (
                <div key={character.id} className="opacity-50">
                  <div className="bg-white rounded-lg shadow-md p-4">
                    <p className="text-sm text-gray-500">
                      {character.name} - 暂无生涯数据
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 统计信息 */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            数据统计
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">
                {Object.keys(lifeStages).length}
              </p>
              <p className="text-sm text-gray-600">武将总数</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">9</p>
              <p className="text-sm text-gray-600">赛季数量</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">
                {Object.keys(lifeStages).length * 9}
              </p>
              <p className="text-sm text-gray-600">数据条目</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">4</p>
              <p className="text-sm text-gray-600">生涯阶段</p>
            </div>
          </div>
        </div>
      </div>

      {/* 生涯详情弹窗 */}
      {selectedCharacter && (
        <LifeStageDetail
          characterData={selectedCharacter}
          onClose={() => setSelectedCharacter(null)}
        />
      )}
    </div>
  );
}
