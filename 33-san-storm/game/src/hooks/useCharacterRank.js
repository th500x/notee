import { useState, useEffect } from 'react';
import { playerAPI } from '@/services/playerApi';

/**
 * 拉取编组「将领排名」展示用（同服同 bucket）
 * @param {string|null} playerId
 * @param {string|null} rankBucket
 * @returns {{ rank: number, total: number } | null}
 */
export function useCharacterRank(playerId, rankBucket) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!playerId || !rankBucket) {
      setInfo(null);
      return undefined;
    }
    let cancelled = false;
    playerAPI.getCharacterRank(playerId, rankBucket).then((res) => {
      if (cancelled || !res?.success || !res.data) return;
      const d = res.data;
      if (d.rank != null && d.total != null) {
        setInfo({ rank: d.rank, total: d.total });
      } else {
        setInfo(null);
      }
    }).catch(() => {
      if (!cancelled) setInfo(null);
    });
    return () => { cancelled = true; };
  }, [playerId, rankBucket]);

  return info;
}
