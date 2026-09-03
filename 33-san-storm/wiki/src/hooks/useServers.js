/**
 * 服务器数据Hook
 * 
 * @description 封装服务器数据获取逻辑
 * @module hooks/useServers
 */

import { useState, useEffect } from 'react';
import { loadSeasonData } from '@/services/dataService';
import { SERVER_STATUS } from '@/constants';
import { gameConfig } from '@/config';

/**
 * 获取服务器状态
 * @param {number} activePlayerCount - 激活玩家数
 * @returns {string} 服务器状态
 */
function getServerStatus(activePlayerCount) {
  if (activePlayerCount >= gameConfig.maxPlayersPerServer) {
    return SERVER_STATUS.FULL;
  } else if (activePlayerCount >= gameConfig.serverCrowdedThreshold) {
    return SERVER_STATUS.CROWDED;
  } else if (activePlayerCount > gameConfig.serverIdleThreshold) {
    return SERVER_STATUS.POPULAR;
  } else {
    return SERVER_STATUS.IDLE;
  }
}

/**
 * 使用服务器数据
 * @param {string} season - 赛季标识（默认'san_1'）
 * @returns {Object} { servers, loading, error, refetch }
 */
export function useServers(season = 'san_1') {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchServers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await loadSeasonData(season, 'servers');
      
      // 处理服务器数据，确保状态正确
      const processedServers = data.servers.map(server => ({
        ...server,
        status: getServerStatus(server.activePlayerCount),
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
  }, [season]);

  return {
    servers,
    loading,
    error,
    refetch: fetchServers,
  };
}
