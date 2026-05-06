import { useState, useEffect, useMemo } from 'react';
import { API_CONFIG } from '@/constants';
import { loadSharedData } from '@/services/dataService';
import { fetchWithTimeout } from '@/services/httpClient';

/**
 * 按郡拉取 `cities` 与势力名映射，供战略大地图 tooltip 按 city_id 合并运行时信息。
 *
 * 合并大地图可能跨行政郡（如颍川四象限含汝南城点）；可传 `junIds` 多郡合并，或与合并 JSON 一致的单个 `junId`。
 *
 * @param {{ junId?: string, junIds?: string[], season: string, refreshKey?: number }} p
 * @returns {{ cityById: Record<string, object>, factionNameById: Record<string, string>, loadState: 'idle'|'loading'|'ok'|'error' }}
 */
export function useStrategicCountyCityRuntime({ junId, junIds, season, refreshKey = 0 }) {
  const [cityById, setCityById] = useState({});
  const [factionNameById, setFactionNameById] = useState({});
  const [loadState, setLoadState] = useState('idle');

  const resolvedJunIds = useMemo(() => {
    if (Array.isArray(junIds) && junIds.length > 0) {
      return [...new Set(junIds.filter(Boolean))];
    }
    if (junId) return [junId];
    return [];
  }, [junId, junIds]);

  const junIdsKey = resolvedJunIds.join(',');

  useEffect(() => {
    const ids = junIdsKey ? junIdsKey.split(',').filter(Boolean) : [];
    if (!ids.length || !season) {
      setCityById({});
      setFactionNameById({});
      setLoadState('idle');
      return undefined;
    }
    let cancelled = false;
    setLoadState('loading');
    (async () => {
      try {
        const citiesResults = await Promise.all(
          ids.map((jid) => {
            const qs = new URLSearchParams({ season, junId: jid });
            return fetchWithTimeout(`${API_CONFIG.BASE_URL}/cities?${qs}`).then((r) => r.json());
          })
        );
        const factionsData = await loadSharedData('factions');
        if (cancelled) return;

        const map = {};
        for (const citiesRes of citiesResults) {
          if (citiesRes.success && Array.isArray(citiesRes.cities)) {
            for (const c of citiesRes.cities) {
              const id = c.city_id || c.id;
              if (id) map[id] = c;
            }
          }
        }
        const fn = {};
        const flist = factionsData?.factions;
        if (Array.isArray(flist)) {
          for (const f of flist) {
            if (f?.id) fn[f.id] = f.name || f.id;
          }
        }
        setCityById(map);
        setFactionNameById(fn);
        setLoadState('ok');
      } catch {
        if (!cancelled) {
          setCityById({});
          setFactionNameById({});
          setLoadState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [junIdsKey, season, refreshKey]);

  return { cityById, factionNameById, loadState };
}
