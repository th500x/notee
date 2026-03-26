/**
 * useExploreQuota - 探索次数配额管理
 * 
 * 规则：
 * - 每小时补充6次探索机会
 * - 上限18次（可叠加3小时）
 * - 晚间 00:00~08:00 不补充次数（💤休息时间）
 * - 使用 localStorage 持久化
 */
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'explore_quota';
const REFILL_PER_HOUR = 6;
const MAX_QUOTA = 18;
const REST_START = 0;  // 00:00
const REST_END = 8;    // 08:00

/** 判断某个小时是否在休息时间内 */
function isRestHour(hour) {
  return hour >= REST_START && hour < REST_END;
}

/** 获取当前小时的整点时间戳 */
function getCurrentHourTs() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
}

/** 计算两个时间戳之间有多少个"活跃小时"（排除休息时间） */
function countActiveHours(fromTs, toTs) {
  if (toTs <= fromTs) return 0;
  let count = 0;
  let ts = fromTs;
  // 安全上限：最多计算48小时，防止死循环
  const maxIterations = 48;
  let i = 0;
  while (ts < toTs && i < maxIterations) {
    const hour = new Date(ts).getHours();
    if (!isRestHour(hour)) count++;
    ts += 3600 * 1000;
    i++;
  }
  return count;
}

/** 从 localStorage 读取并计算当前配额 */
function calcQuota() {
  const currentHourTs = getCurrentHourTs();
  const currentHour = new Date().getHours();
  const freshQuota = { remaining: isRestHour(currentHour) ? 0 : REFILL_PER_HOUR, lastRefillTs: currentHourTs };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // 数据校验：remaining 必须是合理数字
      if (typeof data.remaining !== 'number' || data.remaining < 0 || data.remaining > MAX_QUOTA || !data.lastRefillTs) {
        return freshQuota;
      }
      const activeHours = countActiveHours(data.lastRefillTs, currentHourTs);
      if (activeHours > 0) {
        const refilled = Math.min(data.remaining + activeHours * REFILL_PER_HOUR, MAX_QUOTA);
        return { remaining: refilled, lastRefillTs: currentHourTs };
      }
      // 同一小时内，保持原值
      return data;
    }
  } catch {}
  // 首次使用：非休息时间给一小时的量，休息时间给0
  return freshQuota;
}

export function useExploreQuota() {
  const [quota, setQuota] = useState(calcQuota);

  // 每分钟检查一次是否需要补充
  useEffect(() => {
    const timer = setInterval(() => {
      setQuota(calcQuota());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // 持久化
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quota));
  }, [quota]);

  const consume = useCallback(() => {
    setQuota(prev => {
      if (prev.remaining <= 0) return prev;
      // 更新 lastRefillTs 为当前小时，防止离线后重复补充已消耗的时段
      return { remaining: prev.remaining - 1, lastRefillTs: getCurrentHourTs() };
    });
  }, []);

  const refund = useCallback(() => {
    setQuota(prev => {
      if (prev.remaining >= MAX_QUOTA) return prev;
      return { ...prev, remaining: prev.remaining + 1 };
    });
  }, []);

  // 填满配额（新手指引完成时调用）
  const fillMax = useCallback(() => {
    setQuota({ remaining: MAX_QUOTA, lastRefillTs: getCurrentHourTs() });
  }, []);

  // 计算下次补充的倒计时（分钟），跳过休息时间
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

  const inRestPeriod = isRestHour(currentHour);

  return {
    remaining: quota.remaining,
    max: MAX_QUOTA,
    canExplore: quota.remaining > 0,
    consume,
    refund,
    fillMax,
    minutesUntilRefill,
    inRestPeriod,
    refillPerHour: REFILL_PER_HOUR,
  };
}
