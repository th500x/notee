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
 * 细粒度 selector hook（CR A7 · O3-E3 selector 引擎）：
 * - `usePlayer()`                — 当前玩家档案对象（含资源 / 属性 / 官职 / morale 等）
 * - `useCards()`                 — 当前卡牌列表（character / troop / title / equipment / equipmentSet）
 * - `useAttributeBonusBySlot()`  — 各槽位（player / character1 / character2 / garrison_*）属性加成快照
 * - `useGameTime()`              — 后端推算的赛季内"游戏时间"
 * - `usePlayerRefresh()`         — 主动重拉档案的回调；`refresh({ silent: true })` 不触发 loading 状态
 * - `usePlayerLoadStatus()`      — `{ loading, error }` 加载状态
 *
 * 底层：`useSyncExternalStore` + store 内稳定快照；getSnapshot 须纯函数（同次 render 双调返回同一引用）。
 *
 * @see CR 报告 §3.5 A7、`02-architecture-split/20-frontend-game.md §8`
 */

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  useSyncExternalStore,
} from 'react';
import { playerAPI } from '@/services/playerApi';
import { useExploreQuota } from '@/hooks/useExploreQuota';

const EMPTY_CARDS = Object.freeze([]);
const EMPTY_BONUS_BY_SLOT = Object.freeze({
  player: Object.freeze({}),
  character1: Object.freeze({}),
  character2: Object.freeze({}),
});

/** 首帧占位：与 useExploreQuota 未加载时的语义一致，避免子组件读到 null */
const EMPTY_EXPLORE_QUOTA = Object.freeze({
  remaining: 0,
  max: 18,
  canExplore: false,
  consume: () => {},
  refund: () => {},
  fillMax: () => {},
  minutesUntilRefill: 0,
  inRestPeriod: false,
  refillPerHour: 6,
  loaded: false,
  reloadFromServer: () => Promise.resolve(),
});

function buildContextView(state) {
  return {
    player: state.player,
    cards: state.cards,
    attributeBonusBySlot: state.attributeBonusBySlot,
    gameTime: state.gameTime,
    loading: state.loading,
    error: state.error,
    refresh: state.refresh,
    exploreQuota: state.exploreQuota,
  };
}

function buildLoadStatusView(state) {
  return { loading: state.loading, error: state.error };
}

function createPlayerStore() {
  let state = {
    player: null,
    cards: EMPTY_CARDS,
    attributeBonusBySlot: EMPTY_BONUS_BY_SLOT,
    gameTime: null,
    loading: true,
    error: null,
    refresh: () => {},
    exploreQuota: EMPTY_EXPLORE_QUOTA,
  };
  let contextView = buildContextView(state);
  let loadStatusView = buildLoadStatusView(state);
  const listeners = new Set();

  function rebuildViews() {
    contextView = buildContextView(state);
    loadStatusView = buildLoadStatusView(state);
  }

  return {
    getState: () => state,
    getContextView: () => contextView,
    getLoadStatusView: () => loadStatusView,
    setState(partial) {
      let changed = false;
      for (const key of Object.keys(partial)) {
        if (!Object.is(state[key], partial[key])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      state = { ...state, ...partial };
      rebuildViews();
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const PlayerStoreContext = createContext(null);

function usePlayerStore() {
  const store = useContext(PlayerStoreContext);
  if (!store) {
    throw new Error('usePlayerContext must be used within PlayerProvider');
  }
  return store;
}

/** @param {() => T} getSnapshot 须在同次 render 内多次调用返回同一引用（store 快照） */
function usePlayerStoreSnapshot(getSnapshot) {
  const store = usePlayerStore();
  const getSnapshotRef = useRef(getSnapshot);
  getSnapshotRef.current = getSnapshot;
  const subscribe = store.subscribe;
  const readSnapshot = useCallback(() => getSnapshotRef.current(), [store]);
  return useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
}

export function PlayerProvider({ playerId, children }) {
  const storeRef = useRef(null);
  if (!storeRef.current) {
    storeRef.current = createPlayerStore();
  }
  const store = storeRef.current;

  const loadProfile = useCallback(
    async (options = {}) => {
      const silent = options.silent === true;
      if (!playerId) return;
      try {
        if (!silent) {
          store.setState({ loading: true, error: null });
        }
        const result = await playerAPI.getProfile(playerId);
        if (result.success) {
          const data = result.data;
          const rawCards = data?.cards;
          store.setState({
            player: data?.player || null,
            cards: rawCards && rawCards.length > 0 ? rawCards : EMPTY_CARDS,
            attributeBonusBySlot: data?.attributeBonusBySlot || EMPTY_BONUS_BY_SLOT,
            gameTime: data?.gameTime ?? null,
            ...(silent ? {} : { loading: false, error: null }),
          });
        } else if (!silent) {
          store.setState({
            error: result.error || '加载失败',
            loading: false,
          });
        }
      } catch (err) {
        console.error('[PlayerContext] 加载玩家档案失败:', err);
        if (!silent) {
          store.setState({ error: err.message, loading: false });
        }
      }
    },
    [playerId, store],
  );

  const refresh = useCallback((options) => loadProfile(options), [loadProfile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const exploreQuota = useExploreQuota(playerId);

  useLayoutEffect(() => {
    store.setState({ refresh, exploreQuota });
  }, [store, refresh, exploreQuota]);

  return (
    <PlayerStoreContext.Provider value={store}>
      {children}
    </PlayerStoreContext.Provider>
  );
}

/**
 * 整体 ctx hook（向后兼容；细粒度读请用 selector hook）。
 */
export function usePlayerContext() {
  const store = usePlayerStore();
  return usePlayerStoreSnapshot(() => store.getContextView());
}

/** 当前玩家档案对象（含资源 / 属性 / 官职 / morale 等）。未加载时为 `null`。 */
export function usePlayer() {
  const store = usePlayerStore();
  return usePlayerStoreSnapshot(() => store.getState().player);
}

/** 当前玩家全部卡牌实例。未加载时为冻结的空数组。 */
export function useCards() {
  const store = usePlayerStore();
  return usePlayerStoreSnapshot(() => store.getState().cards);
}

/** 槽位属性加成快照（`player` / `character1` / `character2` / `garrison_*`）。 */
export function useAttributeBonusBySlot() {
  const store = usePlayerStore();
  return usePlayerStoreSnapshot(() => store.getState().attributeBonusBySlot);
}

/** 后端推算的"游戏时间"（赛季内统一时钟，与现实时间不同）。未加载时为 `null`。 */
export function useGameTime() {
  const store = usePlayerStore();
  return usePlayerStoreSnapshot(() => store.getState().gameTime);
}

/** 主动重拉档案的回调；`refresh({ silent: true })` 不触发 loading 状态。 */
export function usePlayerRefresh() {
  const store = usePlayerStore();
  return usePlayerStoreSnapshot(() => store.getState().refresh);
}

/** 加载状态 `{ loading, error }`。 */
export function usePlayerLoadStatus() {
  const store = usePlayerStore();
  return usePlayerStoreSnapshot(() => store.getLoadStatusView());
}
