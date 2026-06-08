/**
 * 真三日报顶栏红点：当日尚未签到时亮起（32-6 §2.2）。
 */

import { useCallback, useEffect, useState } from 'react';
import { playerAPI } from '@/services/playerApi';
import { subscribeDailyReportNotifyRefresh } from '@/utils/dailyReportNotifyRefresh';

const POLL_MS = 60_000;

/**
 * @param {string|undefined|null} playerId
 * @param {boolean} [enabled=true] 仅大地图顶栏需要时可传 activeTab===null
 */
export function useDailyReportCheckinNotify(playerId, enabled = true) {
  const [notifyDot, setNotifyDot] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled || !playerId) {
      setNotifyDot(false);
      return;
    }
    try {
      const res = await playerAPI.getDailyReportCheckinNotify(playerId);
      if (res.success) {
        setNotifyDot(!!res.data?.notifyDot);
      }
    } catch {
      /* 网络失败不改状态 */
    }
  }, [playerId, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !playerId) return undefined;
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
  }, [playerId, enabled, refresh]);

  useEffect(() => subscribeDailyReportNotifyRefresh(refresh), [refresh]);

  return notifyDot;
}
