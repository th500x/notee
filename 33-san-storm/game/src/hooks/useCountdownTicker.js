/**
 * useCountdownTicker
 *
 * 用 `setInterval` 周期性刷新一个 `nowTick` 时间戳，仅用于驱动**依赖当前时刻**的 `useMemo`
 * 在父组件里重新计算（如倒计时显示）。仅在 `enabled === true` 时计时，避免无意义的轮询。
 *
 * 抽离动机（CR 必改 #7 第二阶段，2026-04-29）：
 *   - WorldMap.jsx 中 `pvpSiegeNowTick` + 配套 `setInterval` 是最孤立、最适合外移的"上帝组件"片段；
 *   - 与 PVP 攻城方倒计时强耦合，但实现本身完全独立（输入：是否开启；输出：当前时间戳）；
 *   - 后台标签页 `setInterval(1000)` 易被节流，故沿用原 400ms 节奏。
 *
 * @param {boolean} enabled 仅在攻方挑战 `countdownEndsAt` 存在时为 true
 * @param {number} [intervalMs=400] 刷新节奏；默认 400ms 与原 WorldMap 实现一致
 * @returns {number} 最新时间戳（毫秒）
 *
 * @example
 *   const nowTick = useCountdownTicker(!!pvpChallenge?.countdownEndsAt);
 *   const left = useMemo(() => Math.ceil((endsAt - nowTick) / 1000), [endsAt, nowTick]);
 *
 * @module hooks/useCountdownTicker
 */
import { useState, useEffect } from 'react';

export function useCountdownTicker(enabled, intervalMs = 400) {
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    // 立即对齐一次：enabled 由 false→true 时（如挑战刚发起），避免下一帧前的 nowTick 仍是旧值
    // 导致 `pvpCountdownDisplay` 短暂闪烁；与原 WorldMap.jsx 中 setPvpSiegeNowTick(Date.now())
    // 的"立即 bump"等价。
    setNowTick(Date.now());
    const iv = setInterval(() => setNowTick(Date.now()), intervalMs);
    return () => clearInterval(iv);
  }, [enabled, intervalMs]);

  return nowTick;
}

export default useCountdownTicker;
