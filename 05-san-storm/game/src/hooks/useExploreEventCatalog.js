/**
 * 探索事件配置与玩家进度/背包/城列表拉取（原 useEventSystem.js 数据层）。
 */
import { useState, useEffect, useCallback } from 'react';
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import { EXPLORE_RELATED_TRIGGER_CONTEXTS } from '@/utils/eventExplorePersistence';

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
    const base = API_CONFIG.BASE_URL;
    Promise.all(
      EXPLORE_RELATED_TRIGGER_CONTEXTS.map((ctx) =>
        fetchWithTimeout(`${base}/config/events?triggerContext=${encodeURIComponent(ctx)}`)
          .then((r) => r.json())
          .catch(() => ({ success: false, events: [] })),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const byId = new Map();
        for (const data of results) {
          if (!data?.success || !Array.isArray(data.events)) continue;
          for (const e of data.events) {
            if (e?.event_id) byId.set(e.event_id, e);
          }
        }
        setAllExploreEvents(Array.from(byId.values()));
        const anySuccess = results.some((d) => d?.success);
        if (!anySuccess) {
          const msg = results.find((d) => d?.message)?.message;
          console.error('[useExploreEventCatalog] 加载事件失败:', msg || '全部请求失败');
        }
      })
      .catch((err) => {
        if (!cancelled) console.error('[useExploreEventCatalog] 请求事件 API 失败:', err);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refetchExploreProgress = useCallback(async () => {
    if (!playerId) return null;
    try {
      const res = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/events/explore`);
      const data = await res.json();
      if (data.success) {
        const ev = data.data.events || {};
        setCompletedEvents((prev) => ({ ...prev, ...ev }));
        setExploreSessionLock(data.data.sessionLock ?? null);
        return ev;
      }
    } catch (err) {
      console.error('[useExploreEventCatalog] 加载事件进度失败:', err);
    }
    return null;
  }, [playerId]);

  useEffect(() => {
    if (!playerId) {
      setExploreProgressReady(false);
      return undefined;
    }
    setExploreProgressReady(false);
    let cancelled = false;
    (async () => {
      try {
        await refetchExploreProgress();
      } finally {
        if (!cancelled) setExploreProgressReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId, refetchExploreProgress]);

  useEffect(() => {
    if (!playerId) {
      setPlayerItemCounts({});
      return;
    }
    fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${playerId}/items`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.items) {
          const m = {};
          for (const it of d.data.items) {
            if (it.itemId && it.quantity > 0) m[it.itemId] = it.quantity;
          }
          setPlayerItemCounts(m);
        }
      })
      .catch(() => {});
  }, [playerId]);

  useEffect(() => {
    fetchWithTimeout(`${API_CONFIG.BASE_URL}/cities?season=san_1`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.cities) setCitiesList(d.cities);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchWithTimeout(`${API_CONFIG.BASE_URL}/config/items`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.items) {
          const map = {};
          data.items.forEach((i) => {
            map[i.item_id] = i.item_name;
          });
          setItemNameMap(map);
        }
      })
      .catch((err) => console.error('[useExploreEventCatalog] 加载道具配置失败:', err));
  }, []);

  return {
    allExploreEvents,
    eventsLoading,
    completedEvents,
    setCompletedEvents,
    exploreProgressReady,
    exploreSessionLock,
    setExploreSessionLock,
    refetchExploreProgress,
    playerItemCounts,
    setPlayerItemCounts,
    citiesList,
    itemNameMap,
  };
}

export default useExploreEventCatalog;
