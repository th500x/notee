/**
 * 战略格 tooltip 荒郊/集市内嵌探索条：道具快照 + RETURNING→IDLE 后刷新。
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { PHASE } from '@/components/event/EventConstants';
import { playerAPI } from '@/services/playerApi';

export function useWorldMapExploreSubsidiary({
  player,
  phase,
  quota,
  eventsLoading,
  explorePoolAt,
  startExplore,
  citiesList,
  itemNameMap,
  isTutorial,
  refreshPlayer,
}) {
  const [playerItems, setPlayerItems] = useState([]);

  const fetchItems = useCallback(() => {
    if (!player?.playerId) return;
    playerAPI
      .getItems(player.playerId)
      .then((res) => {
        if (res.success) setPlayerItems(res.data.items || []);
      })
      .catch(() => {});
  }, [player?.playerId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const subsidiaryExploreEmbed = useMemo(
    () => ({
      quota,
      eventsLoading,
      explorePoolAt,
      startExplore,
      playerItems,
      isTutorial,
      phase,
      citiesList,
      itemNameMap,
    }),
    [
      quota,
      eventsLoading,
      explorePoolAt,
      startExplore,
      playerItems,
      isTutorial,
      phase,
      citiesList,
      itemNameMap,
    ],
  );

  const prevPhaseForPostExploreRefreshRef = useRef(phase);
  useEffect(() => {
    const prev = prevPhaseForPostExploreRefreshRef.current;
    prevPhaseForPostExploreRefreshRef.current = phase;
    if (prev !== PHASE.RETURNING || phase !== PHASE.IDLE) return;
    fetchItems();
    refreshPlayer({ silent: true });
    if (typeof quota.reloadFromServer === 'function') {
      void quota.reloadFromServer();
    }
  }, [phase, fetchItems, refreshPlayer, quota]);

  return { playerItems, subsidiaryExploreEmbed };
}

export default useWorldMapExploreSubsidiary;
