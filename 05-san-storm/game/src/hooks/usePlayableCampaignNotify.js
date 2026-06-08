/**
 * 地图 Tab 底栏红点：存在可攻略战役（GET /api/campaign/center 任一 playable）时亮起。
 */

import { useCallback, useEffect, useState } from 'react';
import { campaignAPI } from '@/services/campaignApi';

const POLL_MS = 60_000;

/**
 * @param {string|undefined|null} playerId
 * @returns {{ hasPlayable: boolean, refresh: () => Promise<void> }}
 */
export function usePlayableCampaignNotify(playerId) {
  const [hasPlayable, setHasPlayable] = useState(false);

  const refresh = useCallback(async () => {
    if (!playerId) {
      setHasPlayable(false);
      return;
    }
    try {
      const res = await campaignAPI.getCenter(playerId);
      if (!res?.success) return;
      const any = (res.campaigns || []).some((c) => !!c.playable);
      setHasPlayable(any);
    } catch {
      /* 网络失败时不改状态 */
    }
  }, [playerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!playerId) return undefined;
    const t = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(t);
  }, [playerId, refresh]);

  return { hasPlayable, refresh };
}
