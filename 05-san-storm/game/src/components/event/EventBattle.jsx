/**
 * EventBattle - 事件系统惩罚战斗组件
 *
 * @description 当选项 A 判定为凶/大凶且 triggerBattle=yes 时进入。
 *              敌方编制：默认按事件 `chain_level` → 稀有度 → 匪寨档四槽；
 *              若传入 enemySlotRarities（如匪寨格探索）则覆盖。
 *              因子为 type-b 时多 1 支部队（同池随机，无指定主将）。
 *              选项 B 不会进入本战斗。
 */

import { useCallback, useMemo } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import BattleArena from '@/components/battle/BattleArena';
import { buildPlayerUnitsFromContext } from '@/utils/battlePlayerBuilder';
import { useSkillsMap } from '@/hooks/useSkillsMap';
import { eventChainLevelToBattleRarity } from '@shared/utils/smallMapEnemyRoster';

export default function EventBattle({
  onBattleEnd, playerId, playerName, playerSilver, currentEvent, chosenOption,
  enemySlotRarities = null,
  onDeferredAwayBattleEnd = null,
}) {
  const { player, cards, attributeBonusBySlot } = usePlayerContext();
  const skillsMap = useSkillsMap();

  const playerUnits = useMemo(
    () => buildPlayerUnitsFromContext(player, cards, attributeBonusBySlot, skillsMap),
    [player, cards, attributeBonusBySlot, skillsMap],
  );

  /** 选项因子为 type-b 时在默认惩罚战编制上多一槽敌方部队（将领/部队与 chain_level 稀有度池一致） */
  const eventPunishmentExtraSlot = chosenOption?.mainFactor === 'type-b';

  const eventRarity = useMemo(
    () => eventChainLevelToBattleRarity(currentEvent?.chain_level ?? currentEvent?.chainLevel),
    [currentEvent],
  );

  /** 匪寨格探索：固定传奇档四槽；type-b 多一槽时走 5 编制分支，改以 legendary 池抽满（仍 4+1 全传奇） */
  const banditEventCombat = Array.isArray(enemySlotRarities) && enemySlotRarities.length === 4;
  const effectiveEnemyRarity =
    banditEventCombat && eventPunishmentExtraSlot ? 'legendary' : eventRarity;
  const effectiveEnemySlotRarities =
    banditEventCombat && eventPunishmentExtraSlot ? null : enemySlotRarities;

  const handleEnd = useCallback((result, silverSpent, scoreResult, killedIndices, meta) => {
    onBattleEnd(result, silverSpent, scoreResult, killedIndices, meta);
  }, [onBattleEnd]);

  if (playerUnits.length === 0) {
    // 没有编组，直接判定失败
    onBattleEnd('defeat', 0, null, [], {});
    return null;
  }

  return (
    <BattleArena
      playerUnits={playerUnits}
      cards={cards}
      enemyRarity={effectiveEnemyRarity}
      enemySlotRarities={effectiveEnemySlotRarities}
      silverAmount={playerSilver ?? 0}
      playerFood={player?.food ?? 0}
      playerId={playerId}
      battleType="pve_event"
      opponentName="事件战斗"
      onBattleEnd={handleEnd}
      onDeferredAwayBattleEnd={onDeferredAwayBattleEnd}
      eventExtraEnemyCharacterIds={null}
      eventPunishmentExtraSlot={eventPunishmentExtraSlot}
    />
  );
}
