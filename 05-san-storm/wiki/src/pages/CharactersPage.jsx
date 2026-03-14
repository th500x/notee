/**
 * 将领列表页面
 * 
 * @description 展示所有将领，支持筛选、排序，点击卡牌可翻转查看生涯
 */

import React, { useState, useMemo } from 'react';
import { useCharacters } from '@/hooks/useCharacters';
import { useSkills } from '@/hooks/useSkills';
import { useBonds } from '@/hooks/useBonds';
import { useLifeStages } from '@/hooks/useLifeStages';
import CharacterCard from '@shared/components/card/CharacterCard';

function CharactersPage() {
  const { characters, loading, error, filterCharacters, sortCharacters } = useCharacters();
  const { skillsMap, loading: skillsLoading } = useSkills();
  const { bondsMap, loading: bondsLoading } = useBonds();
  const { getCharacterLifeStage, loading: lifeStagesLoading } = useLifeStages();
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

  if (loading || skillsLoading || bondsLoading || lifeStagesLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">加载将领列表...</p>
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
      <h2 className="text-3xl font-bold text-gray-900 mb-6">将领列表</h2>
      
      {/* 筛选和排序控制 */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 搜索 */}
          <input
            type="text"
            placeholder="搜索将领名字..."
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
            <option value="san_1">san_1 黄巾之乱</option>
            <option value="san_2">san_2 董卓之乱</option>
            <option value="san_3">san_3 群雄割据</option>
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
          共找到 <span className="font-medium text-gray-900">{displayedCharacters.length}</span> 位将领
        </div>
      </div>

      {/* 将领卡片网格 */}
      {displayedCharacters.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-500">没有找到符合条件的将领</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
          {displayedCharacters.map(character => (
            <CharacterCard 
              key={character.id}
              character={character}
              skillsMap={skillsMap}
              bondsMap={bondsMap}
              baseUrl={import.meta.env.BASE_URL}
              lifeStageData={getCharacterLifeStage(character.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CharactersPage;
