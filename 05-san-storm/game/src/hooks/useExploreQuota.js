/**
 * useExploreQuota - 探索次数配额管理（服务端存储）
 * 
 * 规则：
 * - 每小时补充6次探索机会
 * - 上限18次（可叠加3小时）
 * - 晚间 00:00~08:00 不补充次数（💤休息时间）
 * - 数据存储在后端 player_events 表，防止跨浏览器重复恢复
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { playerAPI } from '@/services/playerApi';

const REFILL_PER_HOUR = 6;
const MAX_QUOTA = 18;
const REST_START = 0;
const REST_END = 8;

function isRestHour(hour) {
  return hour >= REST_START && hour < REST_END;
}

export function useExploreQuota(playerId) {
  const [quota, setQuota] = useState({ remaining: 0, lastRefillTs: 0 });
  const [loaded, setLoaded] = useState(false);
  const syncingRef = useRef(false);

  // 从后端加载配额
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    playerAPI.getExploreQuota(playerId)
      .then(res => {
        if (!cancelled && res.success) {
          setQuota({ remaining: res.data.remaining, lastRefillTs: res.data.lastRefillTs });
          setLoaded(true);
        }
      })
      .catch(err => console.error('[useExploreQuota] 加载失败:', err));
    return () => { cancelled = true; };
  }, [playerId]);

  // 每分钟从后端刷新一次（处理恢复）
  useEffect(() => {
    if (!playerId) return;
    const timer = setInterval(() => {
      playerAPI.getExploreQuota(playerId)
        .then(res => {
          if (res.success) {
            setQuota({ remaining: res.data.remaining, lastRefillTs: res.data.lastRefillTs });
          }
        })
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(timer);
  }, [playerId]);

  // 消耗（先乐观更新UI，再同步后端）
  const consume = useCallback(() => {
    if (!playerId || syncingRef.current) return;
    setQuota(prev => {
      if (prev.remaining <= 0) return prev;
      return { ...prev, remaining: prev.remaining - 1 };
    });
    syncingRef.current = true;
    playerAPI.updateExploreQuota(playerId, 'consume')
      .then(res => {
        if (res.success) setQuota(prev => ({ ...prev, remaining: res.data.remaining }));
      })
      .catch(() => {})
      .finally(() => { syncingRef.current = false; });
  }, [playerId]);

  // 退还
  const refund = useCallback(() => {
    if (!playerId) return;
    setQuota(prev => ({ ...prev, remaining: Math.min(prev.remaining + 1, MAX_QUOTA) }));
    playerAPI.updateExploreQuota(playerId, 'refund')
      .then(res => {
        if (res.success) setQuota(prev => ({ ...prev, remaining: res.data.remaining }));
      })
      .catch(() => {});
  }, [playerId]);

  // 填满（新手指引完成时）
  const fillMax = useCallback(() => {
    if (!playerId) return;
    setQuota({ remaining: MAX_QUOTA, lastRefillTs: Date.now() });
    playerAPI.updateExploreQuota(playerId, 'fillMax').catch(() => {});
  }, [playerId]);

  /** 与 `refreshPlayer` 等并列：事件结算/RETURNING→IDLE 后拉服务端真实剩余次数，避免 UI 长期停在乐观值或被误触的 fillMax 覆盖 */
  const reloadFromServer = useCallback(() => {
    if (!playerId) return Promise.resolve();
    return playerAPI.getExploreQuota(playerId).then((res) => {
      if (res.success) {
        setQuota({ remaining: res.data.remaining, lastRefillTs: res.data.lastRefillTs });
        setLoaded(true);
      }
    });
  }, [playerId]);

  // 倒计时计算
  const now = Date.now();
  const currentHour = new Date().getHours();
  let minutesUntilRefill;
  if (isRestHour(currentHour)) {
    const today8am = new Date();
    today8am.setHours(REST_END, 0, 0, 0);
    if (today8am.getTime() <= now) today8am.setDate(today8am.getDate() + 1);
    minutesUntilRefill = Math.max(0, Math.ceil((today8am.getTime() - now) / 60_000));
  } else {
    const nextRefillTs = quota.lastRefillTs + 3600 * 1000;
    minutesUntilRefill = Math.max(0, Math.ceil((nextRefillTs - now) / 60_000));
  }

  return useMemo(
    () => ({
      remaining: quota.remaining,
      max: MAX_QUOTA,
      canExplore: loaded && quota.remaining > 0,
      consume,
      refund,
      fillMax,
      minutesUntilRefill,
      inRestPeriod: isRestHour(currentHour),
      refillPerHour: REFILL_PER_HOUR,
      loaded,
      reloadFromServer,
    }),
    [
      quota.remaining,
      quota.lastRefillTs,
      loaded,
      playerId,
      consume,
      refund,
      fillMax,
      reloadFromServer,
      minutesUntilRefill,
      currentHour,
    ],
  );
}
