/**
 * useSiegeQuota - 攻城次数配额管理（服务端存储）
 * 机制与探索配额完全一致：每小时+6，上限18，00:00~08:00休息
 */
import { useState, useEffect, useCallback } from 'react';
import { API_CONFIG } from '@/constants';

const MAX_QUOTA = 18;
const REFILL_PER_HOUR = 6;
const REST_START = 0;
const REST_END = 8;

function isRestHour(h) { return h >= REST_START && h < REST_END; }

/** 供战略 tooltip / 攻城发起前校验等复用（与 hook 内请求一致） */
export function fetchSiegeQuotaJson(playerId, cityId) {
  if (!playerId || !cityId) return Promise.resolve({ success: false });
  return fetch(`${API_CONFIG.BASE_URL}/cities/${cityId}/siege-quota?playerId=${playerId}`)
    .then((r) => r.json());
}

export function postSiegeQuotaAction(playerId, cityId, action) {
  if (!playerId || !cityId) return Promise.resolve({ success: false });
  return fetch(`${API_CONFIG.BASE_URL}/cities/${cityId}/siege-quota`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, action }),
  }).then((r) => r.json());
}

function fetchQuota(playerId, cityId) {
  return fetchSiegeQuotaJson(playerId, cityId);
}

function postQuota(playerId, cityId, action) {
  return postSiegeQuotaAction(playerId, cityId, action);
}

export function useSiegeQuota(playerId, cityId) {
  const [quota, setQuota] = useState({ remaining: 0, lastRefillTs: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!playerId || !cityId) return;
    let cancelled = false;
    fetchQuota(playerId, cityId)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setQuota({ remaining: res.data.remaining, lastRefillTs: res.data.lastRefillTs });
        } else {
          setQuota({ remaining: 0, lastRefillTs: 0 });
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setQuota({ remaining: 0, lastRefillTs: 0 });
          setLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, [playerId, cityId]);

  useEffect(() => {
    if (!playerId || !cityId) return;
    const timer = setInterval(() => {
      fetchQuota(playerId, cityId).then(res => {
        if (res.success) setQuota({ remaining: res.data.remaining, lastRefillTs: res.data.lastRefillTs });
      }).catch(() => {});
    }, 60_000);
    return () => clearInterval(timer);
  }, [playerId, cityId]);

  const consume = useCallback(() => {
    if (!playerId || !cityId) return;
    setQuota(prev => prev.remaining > 0 ? { ...prev, remaining: prev.remaining - 1 } : prev);
    postQuota(playerId, cityId, 'consume').then(res => {
      if (res.success) setQuota(prev => ({ ...prev, remaining: res.data.remaining }));
    }).catch(() => {});
  }, [playerId, cityId]);

  const refund = useCallback(() => {
    if (!playerId || !cityId) return;
    setQuota(prev => ({ ...prev, remaining: Math.min(prev.remaining + 1, MAX_QUOTA) }));
    postQuota(playerId, cityId, 'refund').catch(() => {});
  }, [playerId, cityId]);

  const now = Date.now();
  const curHour = new Date().getHours();
  let minutesUntilRefill;
  if (isRestHour(curHour)) {
    const t = new Date(); t.setHours(REST_END, 0, 0, 0);
    if (t.getTime() <= now) t.setDate(t.getDate() + 1);
    minutesUntilRefill = Math.max(0, Math.ceil((t.getTime() - now) / 60000));
  } else {
    minutesUntilRefill = Math.max(0, Math.ceil((quota.lastRefillTs + 3600000 - now) / 60000));
  }

  return {
    remaining: quota.remaining, max: MAX_QUOTA,
    canSiege: loaded && quota.remaining > 0,
    consume, refund, loaded,
    minutesUntilRefill, inRestPeriod: isRestHour(curHour), refillPerHour: REFILL_PER_HOUR,
  };
}
