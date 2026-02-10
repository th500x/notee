/**
 * 生涯数据Hook
 * 
 * @description 加载和管理武将生涯数据
 * @module hooks/useLifeStages
 */

import { useState, useEffect } from 'react';
import { loadSharedData } from '@/utils/dataLoader';

/**
 * 加载生涯数据
 * @returns {Object} 包含生涯数据、加载状态和错误信息
 */
export function useLifeStages() {
  const [lifeStages, setLifeStages] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadLifeStages() {
      try {
        setLoading(true);
        const data = await loadSharedData('life-stages');
        setLifeStages(data.lifeStages || {});
        setError(null);
      } catch (err) {
        console.error('Failed to load life stages data:', err);
        setError(err.message);
        setLifeStages({});
      } finally {
        setLoading(false);
      }
    }

    loadLifeStages();
  }, []);

  /**
   * 获取指定武将的生涯数据
   * @param {string} characterId - 武将ID
   * @returns {Object|null} 武将生涯数据
   */
  const getCharacterLifeStage = (characterId) => {
    return lifeStages[characterId] || null;
  };

  /**
   * 获取指定武将在指定赛季的数据
   * @param {string} characterId - 武将ID
   * @param {string} seasonId - 赛季ID（如 'S1', 'S2'）
   * @returns {Object|null} 赛季数据
   */
  const getSeasonData = (characterId, seasonId) => {
    const characterData = lifeStages[characterId];
    if (!characterData) return null;
    
    return characterData.seasons.find(s => s.season === seasonId) || null;
  };

  /**
   * 获取所有武将在指定赛季的统计
   * @param {string} seasonId - 赛季ID
   * @returns {Object} 统计数据
   */
  const getSeasonStats = (seasonId) => {
    const stats = {
      early: 0,
      peak: 0,
      late: 0,
      death: 0,
      total: 0,
    };

    Object.values(lifeStages).forEach(character => {
      const seasonData = character.seasons.find(s => s.season === seasonId);
      if (seasonData) {
        stats[seasonData.stage] = (stats[seasonData.stage] || 0) + 1;
        stats.total += 1;
      }
    });

    return stats;
  };

  return {
    lifeStages,
    loading,
    error,
    getCharacterLifeStage,
    getSeasonData,
    getSeasonStats,
  };
}
