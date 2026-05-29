import { createPortal } from 'react-dom';
import { Suspense, lazy } from 'react';
import ChunkLoadFallback from '@/components/game/ChunkLoadFallback';
import StrategicSettlementCard from '@/components/world/StrategicSettlementCard';

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
}) {
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
            playerId={player?.player_id}
            battleType="pve_bandit"
            opponentName={banditRaidData.opponentName || '匪寨'}
            smallMapPveLoot={banditRaidData.smallMapPveLoot}
            onBattleEnd={onBanditBattleEnd}
          />
        </Suspense>
      ) : null}
      {!banditRaidData && siegeData && !siegeResult ? (
        <Suspense fallback={<ChunkLoadFallback label="进入战场…" />}>
          <BattleArena
            key={siegeData.roadEncounterId || siegeData.warId || siegeData.cityName || 'siege'}
            playerUnits={battlePlayerUnits}
            cards={cards}
            enemyUnits={siegeData.npcGarrison}
            allyUnits={imperialMarchAllyUnits}
            silverAmount={player?.silver ?? 0}
            playerFood={player?.food ?? 0}
            playerId={player?.player_id}
            battleType={siegeData.isPvp ? 'pvp_siege' : 'pve_siege'}
            siegeDefenderType={siegeData.defenderType || 'npc'}
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
            defenseReportMeta={
              siegeData.pvpSiegeRole === 'defender'
                ? null
                : siegeData.defenderType === 'player_garrison' && siegeData.defenderPlayerId
                  ? {
                      warId: siegeData.warId,
                      defenderPlayerId: siegeData.defenderPlayerId,
                      defenderGarrisonSlot: siegeData.defenderGarrisonSlot,
                      attackerPlayerId: player?.player_id,
                      attackerName: player?.character_name || player?.name || '攻城方',
                      cityName: siegeData.cityName,
                      defenderName: siegeData.defenderName,
                    }
                  : siegeData.defenderType === 'pvp_online' && siegeData.defenderPlayerId
                    ? {
                        warId: siegeData.warId,
                        defenderPlayerId: siegeData.defenderPlayerId,
                        defenderGarrisonSlot: siegeData.defenderGarrisonSlot ?? 0,
                        attackerPlayerId: player?.player_id,
                        attackerName: player?.character_name || player?.name || '攻城方',
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
          settlementKind="siege"
          silverReward={siegeResult.silverReward}
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
        />
      ) : null}
    </div>,
    document.body,
  );
}
