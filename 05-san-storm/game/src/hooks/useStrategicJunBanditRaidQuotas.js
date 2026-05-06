import { useState, useEffect, useMemo } from 'react';
import { playerAPI } from '@/services/playerApi';
import { getPhase1BanditPoiIdsForJun } from '@shared/utils/strategicBanditPlaceholderPhase1.js';

async function fetchJunQuotasSnapshot(playerId, junIdList) {
  const entries = await Promise.all(
    junIdList.map(async (jid) => {
      const poiList = getPhase1BanditPoiIdsForJun(jid);
      const rep = poiList[0] || null;
      if (!rep) {
        return [jid, { remaining: 0, max: 18, loaded: true, representativeBanditPoiId: null }];
      }
      try {
        const res = await playerAPI.getBanditRaidQuota(playerId, rep);
        if (!res?.success || !res.data) {
          return [jid, { remaining: 0, max: 18, loaded: true, representativeBanditPoiId: rep }];
        }
        const d = res.data;
        return [
          jid,
          {
            remaining: Number(d.remaining) || 0,
            max: Number(d.max) || 18,
            loaded: true,
            representativeBanditPoiId: rep,
          },
        ];
      } catch {
        return [jid, { remaining: 0, max: 18, loaded: true, representativeBanditPoiId: rep }];
      }
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * 按郡拉取匪寨攻打次数快照（同郡多寨共用 `byJunRaidQuota`，任取该郡一枚 `banditPoiId` 调 GET 即可）。
 * @param {string|null|undefined} playerId
 * @param {readonly string[]|string[]} junIds
 * @param {number} [refreshKey]
 * @returns {Record<string, { remaining: number, max: number, loaded: boolean, representativeBanditPoiId: string|null }>}
 */
export function useStrategicJunBanditRaidQuotas(playerId, junIds, refreshKey = 0) {
  const junKey = useMemo(() => [...(junIds || [])].filter(Boolean).join(','), [junIds]);
  const [byJunId, setByJunId] = useState({});

  useEffect(() => {
    if (!playerId || !junKey) {
      setByJunId({});
      return undefined;
    }
    const ids = junKey.split(',').filter(Boolean);
    let cancelled = false;

    const run = () => {
      void (async () => {
        const snap = await fetchJunQuotasSnapshot(playerId, ids);
        if (!cancelled) setByJunId(snap);
      })();
    };

    run();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      run();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [playerId, junKey, refreshKey]);

  return byJunId;
}
