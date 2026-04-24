import { useState, useEffect, useCallback, useRef } from 'react';
import { playerAPI } from '@/services/playerApi';

/**
 * 战略匪寨攻打次数：GET 服务端按 **郡** 合并后的 `bandit_progress.byJunRaidQuota` 快照；每分钟轻刷。
 * @param {string|null|undefined} playerId
 * @param {string|null|undefined} banditPoiId - 匪寨地图对象 ID **`san_*_bandit_*`**（04-1 §15）
 */
export function useBanditRaidQuota(playerId, banditPoiId) {
  const [state, setState] = useState({
    remaining: 0,
    max: 18,
    refillPerWindow: 6,
    minutesUntilRefill: 0,
    nextLayer: 1,
    personalTotalLayers: 20,
    worldDurability: null,
    difficultyHint: null,
    towerCompleted: false,
    canBattle: false,
    loaded: false,
  });
  const syncingRef = useRef(false);

  const fetchQuota = useCallback(async () => {
    if (!playerId || !banditPoiId || String(banditPoiId).trim() === '') return;
    try {
      const res = await playerAPI.getBanditRaidQuota(playerId, banditPoiId);
      if (!res?.success || !res.data) {
        setState((prev) => ({ ...prev, loaded: true, canBattle: false, towerCompleted: false }));
        return;
      }
      const d = res.data;
      const wd =
        d.worldDurability &&
        typeof d.worldDurability === 'object' &&
        Number.isFinite(Number(d.worldDurability.maxLayers))
          ? {
              maxLayers: Number(d.worldDurability.maxLayers),
              clearedLayers: Number(d.worldDurability.clearedLayers) || 0,
              layersRemaining: Number(d.worldDurability.layersRemaining) || 0,
            }
          : null;
      setState({
        remaining: Number(d.remaining) || 0,
        max: Number(d.max) || 18,
        refillPerWindow: Number(d.refillPerWindow) || 6,
        minutesUntilRefill: Number(d.minutesUntilRefill) || 0,
        nextLayer: Number(d.nextLayer) || 1,
        personalTotalLayers: Number(d.personalTotalLayers) || 20,
        worldDurability: wd,
        difficultyHint: typeof d.difficultyHint === 'string' ? d.difficultyHint : null,
        towerCompleted: !!d.towerCompleted,
        canBattle: !!d.canBattle,
        loaded: true,
      });
    } catch {
      /* 静默：面板仍展示占位 */
    }
  }, [playerId, banditPoiId]);

  useEffect(() => {
    if (!playerId || !banditPoiId) return undefined;
    let cancelled = false;
    (async () => {
      await fetchQuota();
      if (cancelled) return;
    })();
    const t = setInterval(() => {
      void fetchQuota();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [playerId, banditPoiId, fetchQuota]);

  const consume = useCallback(async () => {
    if (!playerId || !banditPoiId || syncingRef.current) return { ok: false };
    syncingRef.current = true;
    try {
      const res = await playerAPI.updateBanditRaidQuota(playerId, banditPoiId, 'consume');
      if (res?.success && res.data) {
        const d = res.data;
        const wd =
          d.worldDurability &&
          typeof d.worldDurability === 'object' &&
          Number.isFinite(Number(d.worldDurability.maxLayers))
            ? {
                maxLayers: Number(d.worldDurability.maxLayers),
                clearedLayers: Number(d.worldDurability.clearedLayers) || 0,
                layersRemaining: Number(d.worldDurability.layersRemaining) || 0,
              }
            : null;
        setState((prev) => ({
          ...prev,
          remaining: Number(d.remaining) || 0,
          minutesUntilRefill: Number(d.minutesUntilRefill) || 0,
          nextLayer: Number(d.nextLayer) || prev.nextLayer,
          personalTotalLayers: Number(d.personalTotalLayers) || prev.personalTotalLayers,
          worldDurability: wd,
          difficultyHint: typeof d.difficultyHint === 'string' ? d.difficultyHint : prev.difficultyHint,
          towerCompleted: !!d.towerCompleted,
          canBattle: !!d.canBattle,
          loaded: true,
        }));
        return { ok: true, data: d };
      }
      return { ok: false, error: res?.error };
    } finally {
      syncingRef.current = false;
    }
  }, [playerId, banditPoiId]);

  return { ...state, refresh: fetchQuota, consume };
}
