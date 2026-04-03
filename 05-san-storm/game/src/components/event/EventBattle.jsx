/**
 * EventBattle - 事件系统惩罚战斗组件
 * 
 * @description 当事件判定为凶/大凶且 triggerBattle=true 时，
 *              使用 BattleArena 通用战斗组件，传入事件稀有度生成敌方
 */

import { useCallback, useMemo } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import BattleArena from '@/components/battle/BattleArena';
import { buildPlayerUnitsFromContext } from '@/utils/battlePlayerBuilder';

export default function EventBattle({
  onBattleEnd, playerId, playerName, playerSilver, currentEvent, chosenOption,
}) {
  const { player, cards, attributeBonusBySlot } = usePlayerContext();

  const playerUnits = useMemo(
    () => buildPlayerUnitsFromContext(player, cards, attributeBonusBySlot),
    [player, cards, attributeBonusBySlot]
  );

  const eventExtraEnemyCharacterIds = useMemo(() => {
    const id = chosenOption?.battleEnemyId ?? chosenOption?.battle_enemy_id;
    return id ? [id] : null;
  }, [chosenOption]);

  // 从事件ID解析稀有度
  const eventRarity = useMemo(() => {
    if (!currentEvent?.event_id) return 'common';
    const parts = currentEvent.event_id.split('_');
    const lastPart = parts[parts.length - 1];
    const map = { '1': 'common', '2': 'rare', '3': 'epic', '4': 'legendary', '5': 'core' };
    return map[lastPart.charAt(0)] || 'common';
  }, [currentEvent]);

  const handleEnd = useCallback((result, silverSpent, scoreResult) => {
    onBattleEnd(result, silverSpent, scoreResult);
  }, [onBattleEnd]);

  if (playerUnits.length === 0) {
    // 没有编组，直接判定失败
    onBattleEnd('defeat', 0, null);
    return null;
  }

  return (
    <BattleArena
      playerUnits={playerUnits}
      cards={cards}
      enemyRarity={eventRarity}
      silverAmount={playerSilver ?? 0}
      playerFood={player?.food ?? 0}
      playerId={playerId}
      battleType="pve_event"
      opponentName="事件战斗"
      onBattleEnd={handleEnd}
      eventExtraEnemyCharacterIds={eventExtraEnemyCharacterIds}
    />
  );
}
