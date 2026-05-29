/**
 * 探索事件目录 API 拉取 + 会话内缓存（O3-A4）。
 * 静态配置（事件池/城表/道具名）跨 hook 实例复用；玩家进度/背包每次 refetch 仍走网络。
 */
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import { EXPLORE_RELATED_TRIGGER_CONTEXTS } from '@/utils/eventExplorePersistence';

const staticCache = {
  exploreEvents: null,
  citiesList: null,
  itemNameMap: null,
};

const inflight = {
  exploreEvents: null,
  citiesList: null,
  itemNameMap: null,
};

function dedupeStatic(key, fetcher) {
  if (staticCache[key] != null) return Promise.resolve(staticCache[key]);
  if (inflight[key]) return inflight[key];
  inflight[key] = fetcher()
    .then((data) => {
      staticCache[key] = data;
      inflight[key] = null;
      return data;
    })
    .catch((err) => {
      inflight[key] = null;
      throw err;
    });
  return inflight[key];
}

export function mergeExploreEventResponses(results) {
  const byId = new Map();
  for (const data of results) {
    if (!data?.success || !Array.isArray(data.events)) continue;
    for (const e of data.events) {
      if (e?.event_id) byId.set(e.event_id, e);
    }
  }
  return Array.from(byId.values());
}

export async function fetchExploreEventsCatalog() {
  return dedupeStatic('exploreEvents', async () => {
    const base = API_CONFIG.BASE_URL;
    const results = await Promise.all(
      EXPLORE_RELATED_TRIGGER_CONTEXTS.map((ctx) =>
        fetchWithTimeout(`${base}/config/events?triggerContext=${encodeURIComponent(ctx)}`)
          .then((r) => r.json())
          .catch(() => ({ success: false, events: [] })),
      ),
    );
    const events = mergeExploreEventResponses(results);
    const anySuccess = results.some((d) => d?.success);
    if (!anySuccess) {
      const msg = results.find((d) => d?.message)?.message;
      console.error('[exploreEventCatalogFetch] 加载事件失败:', msg || '全部请求失败');
    }
    return events;
  });
}

export async function fetchExploreCitiesList() {
  return dedupeStatic('citiesList', async () => {
    const res = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/cities?season=san_1`);
    const d = await res.json();
    if (d.success && d.cities) return d.cities;
    return [];
  });
}

export async function fetchExploreItemNameMap() {
  return dedupeStatic('itemNameMap', async () => {
    const res = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/config/items`);
    const data = await res.json();
    if (!data.success || !data.items) return {};
    const map = {};
    for (const i of data.items) {
      if (i.item_id) map[i.item_id] = i.item_name;
    }
    return map;
  });
}

/** 并行拉取静态探索目录（事件 + 城表 + 道具名） */
export async function fetchExploreCatalogStaticBundle() {
  const [exploreEvents, citiesList, itemNameMap] = await Promise.all([
    fetchExploreEventsCatalog(),
    fetchExploreCitiesList(),
    fetchExploreItemNameMap(),
  ]);
  return { exploreEvents, citiesList, itemNameMap };
}

export function parsePlayerItemCountsResponse(data) {
  if (!data?.success || !data.data?.items) return null;
  const m = {};
  for (const it of data.data.items) {
    if (it.itemId && it.quantity > 0) m[it.itemId] = it.quantity;
  }
  return m;
}

export async function fetchPlayerItemCounts(playerId) {
  const id = playerId != null ? String(playerId).trim() : '';
  if (!id) return null;
  try {
    const res = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${id}/items`);
    const data = await res.json();
    return parsePlayerItemCountsResponse(data);
  } catch (err) {
    console.error('[exploreEventCatalogFetch] 加载背包失败:', err);
    return null;
  }
}

export async function fetchPlayerExploreProgress(playerId) {
  const id = playerId != null ? String(playerId).trim() : '';
  if (!id) return null;
  try {
    const res = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/players/${id}/events/explore`);
    const data = await res.json();
    if (!data.success) return null;
    return {
      events: data.data.events || {},
      sessionLock: data.data.sessionLock ?? null,
    };
  } catch (err) {
    console.error('[exploreEventCatalogFetch] 加载事件进度失败:', err);
    return null;
  }
}

/** 并行拉取玩家探索进度 + 背包（教程 RETURNING→IDLE 等场景） */
export async function fetchPlayerExplorePlayerBundle(playerId) {
  const [progress, itemCounts] = await Promise.all([
    fetchPlayerExploreProgress(playerId),
    fetchPlayerItemCounts(playerId),
  ]);
  return {
    events: progress?.events ?? null,
    sessionLock: progress?.sessionLock ?? null,
    itemCounts,
  };
}
