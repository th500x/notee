/**
 * 武将数据Hook
 * 
 * @description 封装武将数据获取和筛选逻辑
 * @module hooks/useCharacters
 */

import { useState, useEffect, useMemo } from 'react';
import { loadSharedData } from '@/services/dataService';

/**
 * 使用武将数据
 * @returns {Object} { characters, loading, error, refetch, filterCharacters, sortCharacters }
 */
export function useCharacters() {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCharacters = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await loadSharedData('characters');
      
      // 验证数据格式
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format received');
      }
      
      // 验证characters数组
      const charactersArray = data.characters || data;
      if (!Array.isArray(charactersArray)) {
        throw new Error('Characters data must be an array');
      }
      
      setCharacters(charactersArray);
    } catch (err) {
      console.error('[useCharacters] 加载失败:', err);
      setError(err.message || '加载武将数据失败');
      setCharacters([]); // 设置为空数组，避免undefined
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  /**
   * 筛选武将
   * @param {Object} filters - 筛选条件
   * @returns {Array} 筛选后的武将列表
   */
  const filterCharacters = useMemo(() => {
    return (filters = {}) => {
      // 边缘案例：如果characters为空或不是数组，返回空数组
      if (!Array.isArray(characters) || characters.length === 0) {
        return [];
      }
      
      // 边缘案例：如果filters不是对象，使用空对象
      const safeFilters = filters && typeof filters === 'object' ? filters : {};
      
      let filtered = [...characters];

      // 按赛季筛选
      if (safeFilters.season && safeFilters.season !== 'all') {
        const seasonNumber = String(safeFilters.season).replace('S', '');
        filtered = filtered.filter(char => {
          if (!char || !char.id) return false;
          const match = char.id.match(/char_\w+_(\d)/);
          return match && match[1] === seasonNumber;
        });
      }

      // 按势力筛选
      if (safeFilters.faction && safeFilters.faction !== 'all') {
        filtered = filtered.filter(char => 
          char && char.faction === safeFilters.faction
        );
      }

      // 按稀有度筛选
      if (safeFilters.rarity && safeFilters.rarity !== 'all') {
        filtered = filtered.filter(char => 
          char && char.rarity === safeFilters.rarity
        );
      }

      // 按生涯筛选
      if (safeFilters.stage && safeFilters.stage !== 'all') {
        filtered = filtered.filter(char => 
          char && char.stage === safeFilters.stage
        );
      }

      // 按名字搜索
      if (safeFilters.search && typeof safeFilters.search === 'string') {
        const searchLower = safeFilters.search.toLowerCase().trim();
        if (searchLower) {
          filtered = filtered.filter(char => 
            char && char.name && 
            char.name.toLowerCase().includes(searchLower)
          );
        }
      }

      return filtered;
    };
  }, [characters]);

  /**
   * 排序武将
   * @param {Array} chars - 武将列表
   * @param {string} sortBy - 排序字段
   * @param {string} order - 排序方向（'asc' | 'desc'）
   * @returns {Array} 排序后的武将列表
   */
  const sortCharacters = (chars, sortBy = 'id', order = 'desc') => {
    // 边缘案例：验证输入
    if (!Array.isArray(chars) || chars.length === 0) {
      return [];
    }
    
    if (typeof sortBy !== 'string' || !sortBy) {
      sortBy = 'id';
    }
    
    if (order !== 'asc' && order !== 'desc') {
      order = 'desc';
    }
    
    const sorted = [...chars].sort((a, b) => {
      // 边缘案例：处理null/undefined
      if (!a || !b) return 0;
      
      // 特殊处理：按稀有度排序
      if (sortBy === 'rarity') {
        const rarityOrder = {
          'core': 5,
          'legendary': 4,
          'epic': 3,
          'rare': 2,
          'common': 1,
        };
        const aValue = rarityOrder[a.rarity] || 0;
        const bValue = rarityOrder[b.rarity] || 0;
        
        // 稀有度相同时，按ID排序
        if (aValue === bValue) {
          const aId = parseInt((a.id || '').replace(/\D/g, '')) || 0;
          const bId = parseInt((b.id || '').replace(/\D/g, '')) || 0;
          return aId - bId;
        }
        
        return order === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // 特殊处理：按ID排序（提取数字部分）
      if (sortBy === 'id') {
        const aId = parseInt((a.id || '').replace(/\D/g, '')) || 0;
        const bId = parseInt((b.id || '').replace(/\D/g, '')) || 0;
        return order === 'asc' ? aId - bId : bId - aId;
      }

      // 普通排序
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      // 边缘案例：处理undefined值
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return order === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return order === 'asc' 
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    return sorted;
  };

  return {
    characters,
    loading,
    error,
    refetch: fetchCharacters,
    filterCharacters,
    sortCharacters,
  };
}
