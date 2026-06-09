/**
 * 赛季结算状态 Hook（见 19-3 §9.1/§9.3）
 *
 * 拉取并轮询玩家赛季结算状态（phase: none/window_open/sealed/apply_pending/applied）。
 * 进图即拉一次；之后每 60s 轮询 + 切回标签页时重拉——使「赛季结算」入口在到达窗口开始时间、
 * 或运营刚改完配置后**自动出现**，无需手动刷新。
 *
 * 状态供顶栏入口按钮（window_open）、封档横幅（sealed）、发放弹窗（apply_pending）共用。
 */
import { useCallback, useEffect, useState } from 'react';
import { seasonSettlementAPI } from '@/services/seasonSettlementApi';

export function useSeasonSettlement(playerId, active) {
  const [status, setStatus] = useState(null); // { phase, windowOpen, fromSeason, toSeason, claim? }

  const refresh = useCallback(async () => {
    if (!playerId) return;
    const res = await seasonSettlementAPI.getStatus(playerId);
    if (res?.success && res.data) setStatus(res.data);
  }, [playerId]);

  useEffect(() => {
    if (!active || !playerId) return undefined;
    refresh();
    const timer = setInterval(refresh, 60000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, playerId, refresh]);

  return { status, phase: status?.phase || null, refresh };
}

export default useSeasonSettlement;
