/**
 * 个人中心红点：存在 claimStatus=claimable 的成就时提示领取。
 */

import { useCallback, useEffect, useState } from 'react';
import { playerAPI } from '@/services/playerApi';
import { subscribeAchievementNotifyRefresh } from '@/utils/achievementNotifyRefresh';

const POLL_MS = 60_000;

/**
 * @param {string|undefined|null} playerId
 * @returns {boolean}
 */
export function useClaimableAchievementNotify(playerId) {
  const [hasClaimable, setHasClaimable] = useState(false);

  const refresh = useCallback(async () => {
    if (!playerId) {
      setHasClaimable(false);
      return;
    }
    try {
      const res = await playerAPI.getAchievementCatalog(playerId);
      if (!res.success) return;
      const list = res.data?.achievements || [];
      const any = list.some((row) => row.claimStatus === 'claimable');
      setHasClaimable(any);
    } catch {
      /* 网络失败时不改状态 */
    }
  }, [playerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!playerId) return undefined;
    const t = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [playerId, refresh]);

  useEffect(() => subscribeAchievementNotifyRefresh(refresh), [refresh]);

  return hasClaimable;
}
