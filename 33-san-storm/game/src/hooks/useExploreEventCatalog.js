/**
 * 探索事件配置与玩家进度/背包/城列表拉取（原 useEventSystem.js 数据层）。
 * O3-A4：静态目录并行拉取 + 会话内缓存；玩家进度/背包并行 refetch。
 */
import { useState, useEffect, useCallback } from 'react';
import {
  fetchExploreCatalogStaticBundle,
  fetchPlayerExplorePlayerBundle,
  fetchPlayerExploreProgress,
  fetchPlayerItemCounts,
} from '@/utils/exploreEventCatalogFetch';

export function useExploreEventCatalog(playerId) {
  const [allExploreEvents, setAllExploreEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [completedEvents, setCompletedEvents] = useState({});
  const [exploreProgressReady, setExploreProgressReady] = useState(false);
  const [exploreSessionLock, setExploreSessionLock] = useState(null);
  const [playerItemCounts, setPlayerItemCounts] = useState({});
  const [citiesList, setCitiesList] = useState([]);
  const [itemNameMap, setItemNameMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    setEventsLoading(true);
    fetchExploreCatalogStaticBundle()
      .then(({ exploreEvents, citiesList: cities, itemNameMap: itemMap }) => {
        if (cancelled) return;
        setAllExploreEvents(exploreEvents);
        setCitiesList(cities);
        setItemNameMap(itemMap);
      })
      .catch((err) => {
        if (!cancelled) console.error('[useExploreEventCatalog] 静态目录拉取失败:', err);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refetchExploreProgress = useCallback(async () => {
    const progress = await fetchPlayerExploreProgress(playerId);
    if (progress) {
      // 服务端日清会删键：必须整表替换，禁止 merge 把已清除的完成记录回灌
      setCompletedEvents(progress.events && typeof progress.events === 'object' ? progress.events : {});
      setExploreSessionLock(progress.sessionLock);
      return progress.events;
    }
    return null;
  }, [playerId]);

  const refetchPlayerItemCounts = useCallback(async () => {
    const counts = await fetchPlayerItemCounts(playerId);
    if (counts) setPlayerItemCounts(counts);
    return counts;
  }, [playerId]);

  /** 并行拉取 explore 进度 + 背包；RETURNING→IDLE 教程链等避免串行等待 */
  const refetchExplorePlayerBundle = useCallback(async () => {
    const bundle = await fetchPlayerExplorePlayerBundle(playerId);
    if (bundle.events) {
      setCompletedEvents(bundle.events && typeof bundle.events === 'object' ? bundle.events : {});
      setExploreSessionLock(bundle.sessionLock);
    }
    if (bundle.itemCounts) setPlayerItemCounts(bundle.itemCounts);
    return bundle;
  }, [playerId]);

  useEffect(() => {
    if (!playerId) {
      setExploreProgressReady(false);
      setPlayerItemCounts({});
      setCompletedEvents({});
      setExploreSessionLock(null);
      return undefined;
    }
    setExploreProgressReady(false);
    let cancelled = false;
    fetchPlayerExplorePlayerBundle(playerId)
      .then((bundle) => {
        if (cancelled) return;
        if (bundle.events) {
          setCompletedEvents(bundle.events && typeof bundle.events === 'object' ? bundle.events : {});
          setExploreSessionLock(bundle.sessionLock);
        }
        if (bundle.itemCounts) setPlayerItemCounts(bundle.itemCounts);
      })
      .finally(() => {
        if (!cancelled) setExploreProgressReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  return {
    allExploreEvents,
    eventsLoading,
    completedEvents,
    setCompletedEvents,
    exploreProgressReady,
    exploreSessionLock,
    setExploreSessionLock,
    refetchExploreProgress,
    refetchPlayerItemCounts,
    refetchExplorePlayerBundle,
    playerItemCounts,
    setPlayerItemCounts,
    citiesList,
    itemNameMap,
  };
}

export default useExploreEventCatalog;
