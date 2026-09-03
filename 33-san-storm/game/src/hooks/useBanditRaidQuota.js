import { useState, useEffect, useCallback, useRef } from 'react';
import { playerAPI } from '@/services/playerApi';

/**
 * 战略匪寨攻打门闸：GET/POST `bandit-raid-quota`；`remaining` = 持有兵符数。
 * @param {string|null|undefined} playerId
 * @param {string|null|undefined} banditPoiId - 匪寨地图对象 ID **`san_*_bandit_*`**（04-1 §15）
 */
export function useBanditRaidQuota(playerId, banditPoiId) {
  const [state, setState] = useState({
    remaining: 0,
    costPerBattle: 1,
    costItemId: 'item_tactic_token',
    nextLayer: 1,
    personalTotalLayers: 20,
    worldDurability: null,
    difficultyHint: null,
    towerCompleted: false,
    canBattle: false,
    loaded: false,
  });
  const syncingRef = useRef(false);

  const applyData = useCallback((d, prev = {}) => {
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
    return {
      remaining: Number(d.tacticTokens ?? d.remaining) || 0,
      costPerBattle: Math.max(1, Math.floor(Number(d.costPerBattle) || 1)),
      costItemId: typeof d.costItemId === 'string' ? d.costItemId : 'item_tactic_token',
      nextLayer: Number(d.nextLayer) || prev.nextLayer || 1,
      personalTotalLayers: Number(d.personalTotalLayers) || prev.personalTotalLayers || 20,
      worldDurability: wd,
      difficultyHint: typeof d.difficultyHint === 'string' ? d.difficultyHint : prev.difficultyHint ?? null,
      towerCompleted: !!d.towerCompleted,
      canBattle: !!d.canBattle,
      loaded: true,
    };
  }, []);

  const fetchQuota = useCallback(async () => {
    if (!playerId || !banditPoiId || String(banditPoiId).trim() === '') return;
    try {
      const res = await playerAPI.getBanditRaidQuota(playerId, banditPoiId);
      if (!res?.success || !res.data) {
        setState((prev) => ({ ...prev, loaded: true, canBattle: false, towerCompleted: false }));
        return;
      }
      setState((prev) => applyData(res.data, prev));
    } catch {
      /* 静默：面板仍展示占位 */
    }
  }, [playerId, banditPoiId, applyData]);

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
        setState((prev) => applyData(res.data, prev));
        return { ok: true, data: res.data };
      }
      return { ok: false, error: res?.error };
    } finally {
      syncingRef.current = false;
    }
  }, [playerId, banditPoiId, applyData]);

  return { ...state, refresh: fetchQuota, consume };
}
