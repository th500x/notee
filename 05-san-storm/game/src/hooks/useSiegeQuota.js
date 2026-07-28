/**
 * useSiegeQuota — 攻城开战预检：持有兵符数（与匪寨 `item_tactic_token` 同源）。
 *
 * **扣减权威**：开战由后端 `consumeSiegeQuotaForBattleStart`（实际扣兵符）在 initiate API 内完成；
 * 本 hook 仅展示/预检，**勿**在开战路径再调 `postSiegeQuotaAction('consume')`。
 */
import { useState, useEffect, useCallback } from 'react';
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import { SIEGE_TACTIC_TOKEN_COST } from '@/utils/siegeTacticTokenQuota';

/** 供战略 tooltip / 攻城发起前校验等复用（与 hook 内请求一致） */
export function fetchSiegeQuotaJson(playerId, cityId) {
  if (!playerId || !cityId) return Promise.resolve({ success: false });
  return fetchWithTimeout(`${API_CONFIG.BASE_URL}/cities/${cityId}/siege-quota?playerId=${playerId}`).then(
    (r) => r.json(),
  );
}

export function postSiegeQuotaAction(playerId, cityId, action) {
  if (!playerId || !cityId) return Promise.resolve({ success: false });
  return fetchWithTimeout(`${API_CONFIG.BASE_URL}/cities/${cityId}/siege-quota`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, action }),
  }).then((r) => r.json());
}

export function useSiegeQuota(playerId, cityId) {
  const [remaining, setRemaining] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const costPerBattle = SIEGE_TACTIC_TOKEN_COST;

  const refresh = useCallback(() => {
    if (!playerId || !cityId) return Promise.resolve();
    return fetchSiegeQuotaJson(playerId, cityId)
      .then((res) => {
        if (res?.success) {
          setRemaining(Math.max(0, Number(res.data?.remaining) || 0));
        } else {
          setRemaining(0);
        }
        setLoaded(true);
      })
      .catch(() => {
        setRemaining(0);
        setLoaded(true);
      });
  }, [playerId, cityId]);

  useEffect(() => {
    if (!playerId || !cityId) return undefined;
    let cancelled = false;
    refresh().then(() => {
      if (cancelled) return;
    });
    const timer = setInterval(() => {
      void refresh();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [playerId, cityId, refresh]);

  return {
    remaining,
    costPerBattle,
    canSiege: loaded && remaining >= costPerBattle,
    loaded,
    refresh,
  };
}
