/**
 * 玩家状态上下文 — `GamePage` 内共享 `playerAPI.getProfile()` 的结果（`player` / `cards` /
 * `attributeBonusBySlot` / `gameTime`）+ `loading / error / refresh` 控制信号。
 * 对外暴露的 `cards` 与 **`getProfile`** 档案一致（**不**合并战术进行中 sessionStorage 快照；战中损血仅影响战术入口
 * `buildPlayerUnitsFromContext` → `applyInflightTroopSnapshotToBuiltUnits`，见 `inflightBattleTroopSnapshot.js`）。
 *
 * ## 一对外 API（消费者请优先用细粒度 hook）
 *
 * 整体（向后兼容，30+ 老组件仍在用）：
 * - `usePlayerContext()` — 拿全部 `{ player, cards, attributeBonusBySlot, gameTime, loading, error, refresh, exploreQuota }`
 *
 * 细粒度 selector hook（CR A7，2026-04-29 收口；新代码请走这些）：
 * - `usePlayer()`                — 当前玩家档案对象（含资源 / 属性 / 官职 / morale 等）
 * - `useCards()`                 — 当前卡牌列表（character / troop / title / equipment / equipmentSet）
 * - `useAttributeBonusBySlot()`  — 各槽位（player / character1 / character2 / garrison_*）属性加成快照
 * - `useGameTime()`              — 后端推算的赛季内"游戏时间"
 * - `usePlayerRefresh()`         — 主动重拉档案的回调；`refresh({ silent: true })` 不触发 loading 状态
 * - `usePlayerLoadStatus()`      — `{ loading, error }` 加载状态
 *
 * ## 二未来切到 selector 引擎的预留
 *
 * 原生 `useContext` 不支持按字段订阅 —— 只要 ctx value 引用变，所有消费者都会 re-render。
 * 本文件已经把"默认空对象 / 空数组"hoist 到模块顶层、`value` 用 `useMemo` 包裹，
 * 消除"父组件意外重 render → value 引用变 → 全员被打扰"的常见隐患；但**真正按字段订阅**
 * （`TopStatusBar` 只读 `gameTime`，玩家粮草滴答时**不**重渲染）需要 `useSyncExternalStore +
 * selector`，那是底层引擎换装。
 *
 * 收口后好处：未来如果要切到 selector 引擎，**只改本文件一处**；30+ 消费者使用 hook
 * 名字不变，签名不变，无须 codemod。
 *
 * @see CR 报告 §3.5 A7、`02-architecture-split/20-frontend-game.md §8`
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { playerAPI } from '@/services/playerApi';
import { useExploreQuota } from '@/hooks/useExploreQuota';

// `cards` / `attributeBonusBySlot` 的"默认空值"必须是模块级常量；若每次 render 都用对象 / 数组字面量
// 兜底，引用每次都不同，会让"profile 仍未加载就被消费"的组件不必要地多次 re-render。
const EMPTY_CARDS = Object.freeze([]);
const EMPTY_BONUS_BY_SLOT = Object.freeze({
  player: Object.freeze({}),
  character1: Object.freeze({}),
  character2: Object.freeze({}),
});

const PlayerContext = createContext(null);

export function PlayerProvider({ playerId, children }) {
  const [profile, setProfile] = useState(null); // { player, cards, attributeBonusBySlot, gameTime }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    if (!playerId) return;
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const result = await playerAPI.getProfile(playerId);
      if (result.success) {
        setProfile(result.data);
      } else if (!silent) {
        setError(result.error || '加载失败');
      }
    } catch (err) {
      console.error('[PlayerContext] 加载玩家档案失败:', err);
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const refresh = useCallback((options) => loadProfile(options), [loadProfile]);

  const exploreQuotaPlayerId = profile?.player?.playerId ?? playerId ?? null;
  const exploreQuota = useExploreQuota(exploreQuotaPlayerId);

  const value = useMemo(() => {
    const p = profile?.player || null;
    const rawCards = profile?.cards;
    const cards = rawCards && rawCards.length > 0 ? rawCards : EMPTY_CARDS;
    return {
      player: p,
      cards,
      attributeBonusBySlot: profile?.attributeBonusBySlot || EMPTY_BONUS_BY_SLOT,
      gameTime: profile?.gameTime ?? null,
      loading,
      error,
      refresh,
      exploreQuota,
    };
  }, [profile, loading, error, refresh, playerId, exploreQuota]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

/**
 * 整体 ctx hook（向后兼容；新代码请用细粒度 selector hook）。
 */
export function usePlayerContext() {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayerContext must be used within PlayerProvider');
  }
  return ctx;
}

/* ── selector hooks（CR A7，2026-04-29） ──
 * 共同实现：直接 `useContext(PlayerContext)` + 解构对应字段。
 * 命名分号清楚地宣告组件读了哪些字段，未来切到 selector 引擎时只需替换 hook 内部实现。
 */

/** 当前玩家档案对象（含资源 / 属性 / 官职 / morale 等）。未加载时为 `null`。 */
export function usePlayer() {
  return usePlayerContext().player;
}

/** 当前玩家全部卡牌实例。未加载时为冻结的空数组。 */
export function useCards() {
  return usePlayerContext().cards;
}

/** 槽位属性加成快照（`player` / `character1` / `character2` / `garrison_*`）。 */
export function useAttributeBonusBySlot() {
  return usePlayerContext().attributeBonusBySlot;
}

/** 后端推算的"游戏时间"（赛季内统一时钟，与现实时间不同）。未加载时为 `null`。 */
export function useGameTime() {
  return usePlayerContext().gameTime;
}

/** 主动重拉档案的回调；`refresh({ silent: true })` 不触发 loading 状态。 */
export function usePlayerRefresh() {
  return usePlayerContext().refresh;
}

/**
 * 加载状态 `{ loading, error }`。返回值用 `useMemo` 包裹引用稳定，避免消费者用 `===` 判定不到值变化。
 */
export function usePlayerLoadStatus() {
  const { loading, error } = usePlayerContext();
  return useMemo(() => ({ loading, error }), [loading, error]);
}
