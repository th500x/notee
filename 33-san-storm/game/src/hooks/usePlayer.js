/**
 * 玩家Hook
 * 
 * @description 管理玩家状态和操作
 */

import { useState, useEffect } from 'react';
import { playerAPI } from '@/services/playerApi';
import { playerTokenManager } from '@/utils/playerTokenManager';

export function usePlayer(playerId) {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    if (!playerId) {
      setLoading(false);
      return;
    }

    loadPlayer();
  }, [playerId]);

  const loadPlayer = async () => {
    try {
      setLoading(true);
      setError(null);
      setMaintenance(false);

      const result = await playerAPI.checkExists(playerId);

      // 服务器维护态：后端门禁返回 503 MAINTENANCE_MODE → 上层显示维护屏，勿误判为「无角色」走创角
      if (result.code === 'MAINTENANCE_MODE') {
        setMaintenance(true);
        setPlayer(null);
        return;
      }

      if (result.success && result.data.exists) {
        const playerResult = await playerAPI.getPlayer(playerId);
        if (playerResult.code === 'MAINTENANCE_MODE') {
          setMaintenance(true);
          setPlayer(null);
          return;
        }
        if (playerResult.success) {
          setPlayer(playerResult.data);
        }
      } else {
        setPlayer(null);
      }
    } catch (err) {
      console.error('加载玩家失败:', err);
      // 如果是404或网络错误，可能用户已被删除，清除本地登录状态
      if (err.message?.includes('404') || err.message?.includes('不存在')) {
        console.warn('[usePlayer] 用户可能已被删除，清除本地登录状态');
        localStorage.removeItem('gameUser');
        playerTokenManager.clear();
      }
      setError(err.message);
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    loadPlayer();
  };

  return {
    player,
    loading,
    error,
    maintenance,
    refresh,
    hasCharacter: player !== null
  };
}
