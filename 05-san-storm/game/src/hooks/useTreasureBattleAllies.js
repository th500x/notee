import { useEffect, useMemo, useState } from 'react';
import { fetchTreasureBattleAllies } from '@/services/battleApi';
import { battleAllyNpcsToUnits } from '@/utils/battleAllyUnits';

/**
 * 开战前拉取宝物 `battle_ally` 助阵（服务端随机）。
 *
 * @param {string|null|undefined} playerId
 * @param {Array|null|undefined} playerUnits buildPlayerUnitsFromContext 产出
 * @param {{ garrisonCityId?: string, garrisonSlot?: number }} [garrisonContext]
 */
export function useTreasureBattleAllies(playerId, playerUnits, garrisonContext = null) {
  const [treasureAllyUnits, setTreasureAllyUnits] = useState([]);
  const [ready, setReady] = useState(false);

  const equippedBy = useMemo(() => {
    const slots = new Set();
    for (const u of playerUnits || []) {
      if (u?.lineupSlot) slots.add(u.lineupSlot);
    }
    return [...slots];
  }, [playerUnits]);

  const garrisonKey = garrisonContext
    ? `${garrisonContext.garrisonCityId || ''}:${garrisonContext.garrisonSlot ?? ''}`
    : '';

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    if (!playerId || equippedBy.length === 0) {
      setTreasureAllyUnits([]);
      setReady(true);
      return undefined;
    }

    (async () => {
      try {
        const npcs = await fetchTreasureBattleAllies(playerId, {
          equippedBy,
          garrisonCityId: garrisonContext?.garrisonCityId,
          garrisonSlot: garrisonContext?.garrisonSlot,
        });
        if (cancelled) return;
        setTreasureAllyUnits(battleAllyNpcsToUnits(npcs));
      } catch (e) {
        if (!cancelled) {
          console.warn('[useTreasureBattleAllies]', e?.message || e);
          setTreasureAllyUnits([]);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playerId, equippedBy.join(','), garrisonKey]);

  return { treasureAllyUnits, treasureAlliesReady: ready };
}
