import { createPortal } from 'react-dom';
import { Suspense, lazy, useMemo } from 'react';
import ChunkLoadFallback from '@/components/game/ChunkLoadFallback';
import StrategicSettlementCard from '@/components/world/StrategicSettlementCard';
import { isPvpDuelDefenderType } from '@/utils/pvpDefenseSettlement';
import {
  canContinueWorldMapNpcSiege,
  isWorldMapNpcSiegeBgmContext,
} from '@/hooks/useWorldMapStrategicBattles';
import { useBgmScene } from '@/hooks/useBgmScene';
import { buildBanditBetweenLayerHealTroopRows } from '@/utils/inflightBattleTroopSnapshot';

const BattleArena = lazy(() => import('@/components/battle/BattleArena'));

/** 攻城/匪寨战斗与结算全屏 portal（挂 body，避免 GamePage overflow 裁切） */
export default function WorldMapBattlePortal({
  open,
  banditRaidData,
  siegeData,
  siegeResult,
  banditRaidResult,
  battlePlayerUnits,
  cards,
  player,
  imperialMarchAllyUnits,
  onBanditBattleEnd,
  onSiegeBattleEnd,
  onCloseSiegeResult,
  onCloseBanditResult,
  onBanditContinue,
  onBanditDefeatAbandon,
  onSiegeContinue,
}) {
  const siegeNpcBgm = isWorldMapNpcSiegeBgmContext(siegeData);
  /** 匪寨 / 攻城·攻大本营：战斗 + 结算 + 点「继续」期间保持小型战 BGM，仅「退出/确定/放弃」后恢复大地图 */
  useBgmScene(banditRaidData || banditRaidResult || siegeNpcBgm ? 'battle_small' : null);

  const siegeContinueEligible =
    typeof onSiegeContinue === 'function' && canContinueWorldMapNpcSiege(siegeData, siegeResult);

  const banditHealTroops = useMemo(() => {
    if (banditRaidResult?.result !== 'victory') return null;
    if (
      Array.isArray(banditRaidResult.banditHealTroops) &&
      banditRaidResult.banditHealTroops.length > 0
    ) {
      return banditRaidResult.banditHealTroops;
    }
    return buildBanditBetweenLayerHealTroopRows(player?.playerId, cards);
  }, [banditRaidResult, player?.playerId, cards]);

  if (typeof document === 'undefined' || !open) return null;

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-[225] flex min-h-0 flex-col">
      {banditRaidData ? (
        <Suspense fallback={<ChunkLoadFallback label="进入战场…" />}>
          <BattleArena
            key={`bandit-${banditRaidData.banditPoiId}-${banditRaidData.attackedLayer}`}
            playerUnits={battlePlayerUnits}
            cards={cards}
            enemySlotRarities={banditRaidData.enemySlotRarities}
            silverAmount={player?.silver ?? 0}
            playerFood={player?.food ?? 0}
            playerId={player?.playerId}
            battleType="pve_bandit"
            opponentName={banditRaidData.opponentName || '匪寨'}
            smallMapPveLoot={banditRaidData.smallMapPveLoot}
            onBattleEnd={onBanditBattleEnd}
            bgmSceneManagedByParent
          />
        </Suspense>
      ) : null}
      {!banditRaidData && siegeData && !siegeResult && !siegeData.autoBattleResolved ? (
        <Suspense fallback={<ChunkLoadFallback label="进入战场…" />}>
          <BattleArena
            key={siegeData.roadEncounterId || siegeData.warId || siegeData.cityName || 'siege'}
            playerUnits={battlePlayerUnits}
            cards={cards}
            enemyUnits={siegeData.npcGarrison}
            allyUnits={imperialMarchAllyUnits}
            silverAmount={player?.silver ?? 0}
            playerFood={player?.food ?? 0}
            playerId={player?.playerId}
            battleType={siegeData.isPvp ? 'pvp_siege' : 'pve_siege'}
            siegeDefenderType={siegeData.defenderType || 'npc'}
            bgmSceneManagedByParent={isWorldMapNpcSiegeBgmContext(siegeData)}
            opponentName={
              siegeData.pvpDefenderBaseCampSiege
                ? siegeData.opponentName || '攻方大本营守军'
                : siegeData.pvpSiegeRole === 'defender'
                  ? siegeData.attackerName || '攻城方'
                  : siegeData.isPvp
                    ? siegeData.defenderName || `${siegeData.cityName || ''}守军`
                    : `${siegeData.cityName}守军`
            }
            onBattleEnd={onSiegeBattleEnd}
            recordOnly={!!siegeData.skipSiegeResult}
            cityDefense={siegeData.cityDefense}
            siegeCityDefenseMult={siegeData.siegeCityDefenseMult}
            pvpSiegeRole={siegeData.pvpSiegeRole}
            pvpDefenderBaseCampSiege={!!siegeData.pvpDefenderBaseCampSiege}
            defenseReportMeta={
              siegeData.pvpSiegeRole === 'defender'
                ? null
                : siegeData.defenderType === 'player_garrison' && siegeData.defenderPlayerId
                  ? {
                      warId: siegeData.warId,
                      defenderPlayerId: siegeData.defenderPlayerId,
                      defenderGarrisonSlot: siegeData.defenderGarrisonSlot,
                      attackerPlayerId: player?.playerId,
                      attackerName: player?.characterName || player?.name || '攻城方',
                      cityName: siegeData.cityName,
                      defenderName: siegeData.defenderName,
                    }
                  : siegeData.defenderType === 'pvp_online' && siegeData.defenderPlayerId
                    ? {
                        warId: siegeData.warId,
                        defenderPlayerId: siegeData.defenderPlayerId,
                        defenderGarrisonSlot: siegeData.defenderGarrisonSlot ?? 0,
                        attackerPlayerId: player?.playerId,
                        attackerName: player?.characterName || player?.name || '攻城方',
                        cityName: siegeData.cityName,
                        defenderName: siegeData.defenderName,
                      }
                    : null
            }
          />
        </Suspense>
      ) : null}
      {!banditRaidData && siegeResult ? (
        <StrategicSettlementCard
          onConfirm={onCloseSiegeResult}
          onBanditContinue={siegeContinueEligible ? onSiegeContinue : null}
          settlementKind="siege"
          silverReward={siegeResult.silverReward}
          personalSilverEarned={siegeResult.personalSilverEarned}
          factionSilverToPool={siegeResult.factionSilverToPool}
          siegeRewardPersonalSharePct={siegeResult.siegeRewardPersonalSharePct}
          reputationReward={siegeResult.reputationReward}
          contributionReward={siegeResult.contributionReward}
          foodReward={siegeResult.foodReward ?? 0}
          equipmentDrop={siegeResult.equipmentDrop ?? null}
          chestRewards={siegeResult.chestRewards}
          killCount={siegeResult.killCount}
          siegeNpcKilled={siegeResult.npcKilled}
          siegeNpcTotal={siegeResult.npcTotal}
          authoritativeBattleLog={siegeResult.authoritativeBattleLog}
          initialAttackerTroops={siegeResult.initialAttackerTroops}
          initialDefenderTroops={siegeResult.initialDefenderTroops}
          showZeroKillNote={siegeResult.killCount === 0}
          siegeCompleted={!!siegeResult.siegeCompleted}
          battleReportFailed={!!siegeResult.battleReportFailed}
          hideNpcGarrisonLine={isPvpDuelDefenderType(siegeResult.defenderType)}
          playerVictory={
            siegeResult.attackerWon != null ? !!siegeResult.attackerWon : null
          }
        />
      ) : null}
      {banditRaidResult ? (
        <StrategicSettlementCard
          onConfirm={onCloseBanditResult}
          onBanditContinue={
            banditRaidResult.result === 'victory' ? onBanditContinue : null
          }
          onBanditDefeatAbandon={
            banditRaidResult.result !== 'victory' ? onBanditDefeatAbandon : null
          }
          banditOutcome={banditRaidResult.result}
          settlementKind="bandit"
          silverReward={banditRaidResult.silverReward}
          reputationReward={banditRaidResult.reputationReward}
          contributionReward={0}
          foodReward={banditRaidResult.foodReward ?? 0}
          banditBaseSilver={banditRaidResult.banditBaseSilver ?? 0}
          banditBaseFood={banditRaidResult.banditBaseFood ?? 0}
          banditMilestone={banditRaidResult.banditMilestone ?? null}
          equipmentDrop={null}
          chestRewards={banditRaidResult.meta?.chestRewards}
          killCount={null}
          banditOpponentName={banditRaidResult.opponentName}
          tacticalScoreText={banditRaidResult.tacticalScoreText}
          authoritativeBattleLog={null}
          initialAttackerTroops={null}
          initialDefenderTroops={null}
          showZeroKillNote={false}
          siegeCompleted={false}
          battleReportFailed={banditRaidResult.meta?.battleReportSaved === false}
          extraFooterNote={banditRaidResult.defeatHint}
          banditBadgeGranted={banditRaidResult.meta?.banditBadgeGranted}
          banditBadgeError={banditRaidResult.meta?.banditBadgeError}
          banditHealTroops={banditHealTroops}
          playerFood={player?.food ?? 0}
        />
      ) : null}
    </div>,
    document.body,
  );
}
