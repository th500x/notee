/**
 * 势力数据Hook
 * 
 * @description 封装势力数据获取逻辑
 * @module hooks/useFactions
 */

import { useState, useEffect } from 'react';
import { loadSeasonData } from '@/utils/dataLoader';

/**
 * 使用势力数据
 * @param {string} season - 赛季标识（默认's1'）
 * @returns {Object} { factions, loading, error, refetch }
 */
export function useFactions(season = 's1') {
  const [factions, setFactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFactions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await loadSeasonData(season, 'factions');
      setFactions(data.factions);
    } catch (err) {
      console.error('[useFactions] 加载失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFactions();
  }, [season]);

  return {
    factions,
    loading,
    error,
    refetch: fetchFactions,
  };
}
