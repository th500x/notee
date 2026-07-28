/**
 * 探索开链消耗：兵符 `item_tactic_token`（与匪寨/攻城同源）。
 * 对外仍挂在 PlayerContext 的 `exploreQuota` 上，便于既有面板少改调用点。
 *
 * - remaining = 持有兵符数
 * - canExplore = remaining >= 1（续链由 useEventSystem continueChain 跳过扣费）
 * - consume/refund 走 `/explore-chain-token`（权威扣减）
 * - fillMax：教程通关后的旧钩子，现为 no-op（兵符不由此补满）
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { playerAPI } from '@/services/playerApi';

export function useExploreQuota(playerId) {
  const [remaining, setRemaining] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const syncingRef = useRef(false);

  const applyRemaining = useCallback((n) => {
    setRemaining(Math.max(0, Math.floor(Number(n) || 0)));
  }, []);

  const refresh = useCallback(async () => {
    if (!playerId) return;
    try {
      const res = await playerAPI.getExploreChainToken(playerId);
      if (res?.success && res.data) applyRemaining(res.data.remaining);
      else {
        const legacy = await playerAPI.getExploreQuota(playerId);
        if (legacy?.success && legacy.data) applyRemaining(legacy.data.remaining);
      }
    } catch (err) {
      console.error('[useExploreQuota] 加载兵符失败:', err);
    } finally {
      setLoaded(true);
    }
  }, [playerId, applyRemaining]);

  useEffect(() => {
    if (!playerId) return undefined;
    let cancelled = false;
    (async () => {
      await refresh();
      if (cancelled) return;
    })();
    const timer = setInterval(() => {
      void refresh();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [playerId, refresh]);

  /**
   * @param {{ continueChain?: boolean, triggerContext?: string }} [opts]
   * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string }>}
   */
  const consume = useCallback(
    async (opts = {}) => {
      if (!playerId || syncingRef.current) return { ok: false, error: 'busy' };
      syncingRef.current = true;
      try {
        const res = await playerAPI.updateExploreChainToken(playerId, {
          action: 'consume',
          continueChain: !!opts.continueChain,
          triggerContext: opts.triggerContext || undefined,
        });
        if (!res?.success) {
          return { ok: false, error: res?.error || '兵符不足' };
        }
        if (res.data?.remaining != null) applyRemaining(res.data.remaining);
        return { ok: true, skipped: !!res.data?.skipped };
      } catch (e) {
        return { ok: false, error: e?.message || '网络错误' };
      } finally {
        syncingRef.current = false;
      }
    },
    [playerId, applyRemaining]
  );

  const refund = useCallback(async () => {
    if (!playerId) return { ok: false };
    try {
      const res = await playerAPI.updateExploreChainToken(playerId, { action: 'refund' });
      if (res?.success && res.data?.remaining != null) applyRemaining(res.data.remaining);
      return { ok: !!res?.success };
    } catch {
      return { ok: false };
    }
  }, [playerId, applyRemaining]);

  /** 教程通关旧钩子：兵符体系下不再补满次数 */
  const fillMax = useCallback(() => {}, []);

  return useMemo(
    () => ({
      remaining,
      max: remaining,
      canExplore: remaining >= 1,
      refillPerHour: 0,
      minutesUntilRefill: 0,
      inRestPeriod: false,
      loaded,
      costKind: 'tactic_token',
      costPerChain: 1,
      consume,
      refund,
      fillMax,
      refresh,
    }),
    [remaining, loaded, consume, refund, fillMax, refresh]
  );
}
