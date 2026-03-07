/**
 * 势力数据Hook
 * 
 * @description 封装势力数据获取逻辑
 * @module hooks/useFactions
 */

import { useState, useEffect } from 'react';
import { loadSharedData } from '@/services/dataService';

/**
 * 使用势力数据
 * @returns {Object} { factions, loading, error, refetch }
 */
export function useFactions() {
  const [factions, setFactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFactions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await loadSharedData('factions');
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
  }, []);

  return {
    factions,
    loading,
    error,
    refetch: fetchFactions,
  };
}
