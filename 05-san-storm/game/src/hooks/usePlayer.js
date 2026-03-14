/**
 * 玩家Hook
 * 
 * @description 管理玩家状态和操作
 */

import { useState, useEffect } from 'react';
import { playerAPI } from '@/services/playerApi';

export function usePlayer(playerId) {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

      const result = await playerAPI.checkExists(playerId);
      
      if (result.success && result.data.exists) {
        const playerResult = await playerAPI.getPlayer(playerId);
        if (playerResult.success) {
          setPlayer(playerResult.data);
        }
      } else {
        setPlayer(null);
      }
    } catch (err) {
      console.error('加载玩家失败:', err);
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
    refresh,
    hasCharacter: player !== null
  };
}
