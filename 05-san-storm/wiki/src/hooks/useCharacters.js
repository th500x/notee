/**
 * 武将数据Hook
 * 
 * @description 封装武将数据获取和筛选逻辑
 * @module hooks/useCharacters
 */

import { useState, useEffect, useMemo } from 'react';
import { loadSharedData } from '@/services/dataService';

/** 从将领 ID 解析赛季（如 san_0_char_1001 → san_0） */
export function seasonIdFromCharacterId(id) {
  const m = String(id || '').match(/^(san_\d+)_char_/);
  return m ? m[1] : null;
}

/**
 * 按赛季汇总势力选项（数据驱动，不写死 san_1 列表）
 * @param {Array} characters
 * @param {string} season - 'all' | 'san_0' | 'san_1' …
 */
export function listFactionsForSeason(characters, season = 'all') {
  const pool =
    season === 'all'
      ? characters
      : characters.filter((c) => seasonIdFromCharacterId(c.id) === season);
  const names = [...new Set(pool.map((c) => c.faction).filter(Boolean))];
  return names.sort((a, b) => {
    if (a === '通用') return -1;
    if (b === '通用') return 1;
    return a.localeCompare(b, 'zh-Hans');
  });
}

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
      setCharacters(data.characters);
    } catch (err) {
      console.error('[useCharacters] 加载失败:', err);
      setError(err.message);
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
      let filtered = [...characters];

      // 按赛季筛选（卡牌 ID：san_{n}_char_*）
      if (filters.season && filters.season !== 'all') {
        const idPrefix = `${filters.season}_char_`;
        filtered = filtered.filter((char) => char.id?.startsWith(idPrefix));
      }

      // 按势力筛选
      if (filters.faction && filters.faction !== 'all') {
        filtered = filtered.filter(char => char.faction === filters.faction);
      }

      // 按稀有度筛选
      if (filters.rarity && filters.rarity !== 'all') {
        filtered = filtered.filter(char => char.rarity === filters.rarity);
      }

      // 按生涯筛选
      if (filters.stage && filters.stage !== 'all') {
        filtered = filtered.filter(char => char.stage === filters.stage);
      }

      // 按名字搜索
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(char => 
          char.name.toLowerCase().includes(searchLower)
        );
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
    const sorted = [...chars].sort((a, b) => {
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
          const aId = parseInt(a.id.replace(/\D/g, '')) || 0;
          const bId = parseInt(b.id.replace(/\D/g, '')) || 0;
          return aId - bId;
        }
        
        return order === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // 特殊处理：按ID排序（提取数字部分）
      if (sortBy === 'id') {
        const aId = parseInt(a.id.replace(/\D/g, '')) || 0;
        const bId = parseInt(b.id.replace(/\D/g, '')) || 0;
        return order === 'asc' ? aId - bId : bId - aId;
      }

      // 普通排序
      const aValue = a[sortBy];
      const bValue = b[sortBy];

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
