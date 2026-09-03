/**
 * 势力 Tab 底栏红点：轮询最新公告 id，与 localStorage 已读水位比较。
 */

import { useCallback, useEffect, useState } from 'react';
import { playerAPI } from '@/services/playerApi';
import {
  computeMaxFactionBulletinId,
  getLastSeenFactionBulletinId,
  hasUnreadFactionBulletins,
  markFactionBulletinsSeenUpTo,
  subscribeFactionBulletinReadState,
} from '@/utils/factionBulletinReadState';

const POLL_MS = 60_000;

/**
 * @param {string|undefined|null} playerId
 * @returns {boolean}
 */
export function useFactionBulletinUnread(playerId) {
  const [hasUnread, setHasUnread] = useState(false);

  const refresh = useCallback(async () => {
    if (!playerId) {
      setHasUnread(false);
      return;
    }
    try {
      const res = await playerAPI.getSanGongFuBulletin(playerId, { limitPerCategory: 30 });
      if (!res.success || !res.data) return;
      const maxId = computeMaxFactionBulletinId(res.data);
      const lastSeen = getLastSeenFactionBulletinId(playerId);
      if (lastSeen === null) {
        markFactionBulletinsSeenUpTo(playerId, maxId);
        setHasUnread(false);
        return;
      }
      setHasUnread(hasUnreadFactionBulletins(playerId, res.data));
    } catch {
      /* 网络失败时不改状态，避免误消红点 */
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

  useEffect(() => subscribeFactionBulletinReadState(refresh), [refresh]);

  return hasUnread;
}
