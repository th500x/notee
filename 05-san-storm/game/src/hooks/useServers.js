/**
 * 服务器数据Hook
 * 
 * @description 封装服务器数据获取逻辑（从后端API获取）
 * @module hooks/useServers
 */

import { useState, useEffect } from 'react';
import { serversAPI } from '@/services/api';
import { SERVER_STATUS } from '@/constants';
import { gameConfig } from '@/config';

/**
 * 获取服务器状态
 * @param {number} activePlayerCount - 激活玩家数
 * @param {number} maxPlayers - 最大玩家数
 * @returns {string} 服务器状态
 */
function getServerStatus(activePlayerCount, maxPlayers) {
  if (activePlayerCount >= maxPlayers) {
    return SERVER_STATUS.FULL;
  } else if (activePlayerCount >= maxPlayers * 0.8) {
    return SERVER_STATUS.CROWDED;
  } else if (activePlayerCount > maxPlayers * 0.3) {
    return SERVER_STATUS.POPULAR;
  } else {
    return SERVER_STATUS.IDLE;
  }
}

/**
 * 使用服务器数据
 * @returns {Object} { servers, loading, error, refetch }
 */
export function useServers() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchServers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 从后端API获取服务器列表
      const result = await serversAPI.getServers();
      
      if (!result.success) {
        throw new Error(result.error || '获取服务器列表失败');
      }
      
      // 处理服务器数据，确保状态正确
      const processedServers = result.data.map(server => ({
        ...server,
        status: getServerStatus(server.activePlayerCount, server.maxPlayers),
      }));
      
      setServers(processedServers);
    } catch (err) {
      console.error('[useServers] 加载失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  return {
    servers,
    loading,
    error,
    refetch: fetchServers,
  };
}
