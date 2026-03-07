/**
 * 官职数据Hook
 * 
 * @description 封装官职数据获取逻辑
 * @module hooks/usePositions
 */

import { useState, useEffect } from 'react';
import { loadSharedData } from '@/services/dataService';

/**
 * 使用官职数据
 * @returns {Object} { positions, loading, error, refetch }
 */
export function usePositions() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await loadSharedData('positions');
      // 按level升序排序（level越小等级越高，0=最高，8=最低）
      const sorted = data.positions.sort((a, b) => a.level - b.level);
      setPositions(sorted);
    } catch (err) {
      console.error('[usePositions] 加载失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  return {
    positions,
    loading,
    error,
    refetch: fetchPositions,
  };
}
