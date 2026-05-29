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
 * 底层：`useSyncExternalStore` + 字段 selector；仅订阅所读 slice 的组件在其它字段变化时不 re-render。
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

function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const key of keysA) {
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
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
    exploreQuota: null,
  };
  const listeners = new Set();

  return {
    getState: () => state,
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

/**
 * @template T
 * @param {(state: ReturnType<ReturnType<typeof createPlayerStore>['getState']>) => T} selector
 * @param {(a: T, b: T) => boolean} [isEqual]
 */
function usePlayerStoreSelector(selector, isEqual = Object.is) {
  const store = usePlayerStore();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const isEqualRef = useRef(isEqual);
  isEqualRef.current = isEqual;
  const sliceRef = useRef(undefined);

  const getSnapshot = useCallback(() => {
    const nextSelected = selectorRef.current(store.getState());
    const cached = sliceRef.current;
    if (cached !== undefined && isEqualRef.current(cached, nextSelected)) {
      return cached;
    }
    sliceRef.current = nextSelected;
    return nextSelected;
  }, [store]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

function selectPlayerContextView(state) {
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

  useLayoutEffect(() => {
    store.setState({ refresh });
  }, [store, refresh]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const exploreQuota = useExploreQuota(playerId);

  useLayoutEffect(() => {
    store.setState({ exploreQuota });
  }, [store, exploreQuota]);

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
  return usePlayerStoreSelector(selectPlayerContextView, shallowEqual);
}

/** 当前玩家档案对象（含资源 / 属性 / 官职 / morale 等）。未加载时为 `null`。 */
export function usePlayer() {
  return usePlayerStoreSelector((state) => state.player);
}

/** 当前玩家全部卡牌实例。未加载时为冻结的空数组。 */
export function useCards() {
  return usePlayerStoreSelector((state) => state.cards);
}

/** 槽位属性加成快照（`player` / `character1` / `character2` / `garrison_*`）。 */
export function useAttributeBonusBySlot() {
  return usePlayerStoreSelector((state) => state.attributeBonusBySlot);
}

/** 后端推算的"游戏时间"（赛季内统一时钟，与现实时间不同）。未加载时为 `null`。 */
export function useGameTime() {
  return usePlayerStoreSelector((state) => state.gameTime);
}

/** 主动重拉档案的回调；`refresh({ silent: true })` 不触发 loading 状态。 */
export function usePlayerRefresh() {
  return usePlayerStoreSelector((state) => state.refresh);
}

/** 加载状态 `{ loading, error }`。 */
export function usePlayerLoadStatus() {
  return usePlayerStoreSelector(
    (state) => ({ loading: state.loading, error: state.error }),
    shallowEqual,
  );
}
