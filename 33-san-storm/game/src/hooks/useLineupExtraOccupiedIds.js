/**
 * 拉取本玩家上阵 Extra（A–D）已占用的卡牌实例 ID 集合。
 *
 * @param {string | undefined} playerId
 * @param {any[]} [dependencies=[]]
 * @returns {Set<string>}
 */
import { useState, useEffect } from 'react';
import { lineupExtraAPI } from '@/services/lineupExtraApi';
import { collectLineupExtraOccupiedInstanceIds } from '@/utils/lineupExtraScopeUtils';

export function useLineupExtraOccupiedIds(playerId, dependencies = []) {
  const [occupiedIds, setOccupiedIds] = useState(() => new Set());

  useEffect(() => {
    if (!playerId) {
      setOccupiedIds(new Set());
      return undefined;
    }
    let cancelled = false;
    lineupExtraAPI
      .getAll(playerId)
      .then((res) => {
        if (cancelled) return;
        if (res && res.success) {
          setOccupiedIds(collectLineupExtraOccupiedInstanceIds(res.lineups || []));
        }
      })
      .catch(() => {
        /* 失败时保留上次值 */
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, ...dependencies]);

  return occupiedIds;
}

export default useLineupExtraOccupiedIds;
