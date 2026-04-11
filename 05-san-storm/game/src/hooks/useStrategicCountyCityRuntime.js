import { useState, useEffect } from 'react';
import { API_CONFIG } from '@/constants';
import { loadSharedData } from '@/services/dataService';

/**
 * 按郡拉取 `cities` 与势力名映射，供战略大地图 tooltip 按 city_id 合并运行时信息。
 *
 * @param {{ junId: string, season: string }} p - 与合并 JSON 中 junId/season 一致（如颍川）
 * @returns {{ cityById: Record<string, object>, factionNameById: Record<string, string>, loadState: 'idle'|'loading'|'ok'|'error' }}
 */
export function useStrategicCountyCityRuntime({ junId, season }) {
  const [cityById, setCityById] = useState({});
  const [factionNameById, setFactionNameById] = useState({});
  const [loadState, setLoadState] = useState('idle');

  useEffect(() => {
    if (!junId || !season) {
      setCityById({});
      setFactionNameById({});
      setLoadState('idle');
      return undefined;
    }
    let cancelled = false;
    setLoadState('loading');
    (async () => {
      try {
        const qs = new URLSearchParams({ season, junId });
        const citiesRes = await fetch(`${API_CONFIG.BASE_URL}/cities?${qs}`).then((r) => r.json());
        const factionsData = await loadSharedData('factions');
        if (cancelled) return;

        const map = {};
        if (citiesRes.success && Array.isArray(citiesRes.cities)) {
          for (const c of citiesRes.cities) {
            const id = c.city_id || c.id;
            if (id) map[id] = c;
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
  }, [junId, season]);

  return { cityById, factionNameById, loadState };
}
