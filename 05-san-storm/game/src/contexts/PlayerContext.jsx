/**
 * 玩家状态上下文
 * 
 * @description 在GamePage内共享玩家数据（基础信息 + 卡牌）
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { playerAPI } from '@/services/playerApi';

const PlayerContext = createContext(null);

export function PlayerProvider({ playerId, children }) {
  const [profile, setProfile] = useState(null); // { player, cards }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async () => {
    if (!playerId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await playerAPI.getProfile(playerId);
      if (result.success) {
        setProfile(result.data);
      } else {
        setError(result.error || '加载失败');
      }
    } catch (err) {
      console.error('[PlayerContext] 加载玩家档案失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const refresh = useCallback(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <PlayerContext.Provider value={{
      player: profile?.player || null,
      cards: profile?.cards || [],
      loading,
      error,
      refresh
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayerContext() {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayerContext must be used within PlayerProvider');
  }
  return ctx;
}
