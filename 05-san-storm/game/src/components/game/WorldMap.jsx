/**
 * 大地图：郡级战略格网（world，默认颍川，可通过州郡条切换汝南等已产出 `merged.json` 的郡）；攻城/城况/荒郊等经格上 tooltip 与共享面板。
 */

import { useState, useRef, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useRoadDefenseFriction } from '@/contexts/RoadDefenseFrictionContext';
import { useSkillsMap } from '@/hooks/useSkillsMap';
import useEventSystem from '@/hooks/useEventSystem';
import { PHASE } from '@/components/event/EventConstants';
import ChunkLoadFallback from '@/components/game/ChunkLoadFallback';
import { buildPlayerUnitsFromContext } from '@/utils/battlePlayerBuilder';
import { usePvpDefenseAlertPoll } from '@/hooks/usePvpDefenseAlertPoll';
import { useCountdownTicker } from '@/hooks/useCountdownTicker';
import { useRoadSelfPresencePoll } from '@/hooks/useRoadSelfPresencePoll';
import { usePvpSiegeAdjudication } from '@/hooks/usePvpSiegeAdjudication';
import { useWorldMapStrategicBattles } from '@/hooks/useWorldMapStrategicBattles';
import { useWorldMapCityPanels } from '@/hooks/useWorldMapCityPanels';
import { useWorldMapExploreSubsidiary } from '@/hooks/useWorldMapExploreSubsidiary';
const ExplorePanel = lazy(() => import('@/components/event/ExplorePanel'));
const GarrisonLineup = lazy(() => import('@/components/garrison/GarrisonLineup'));
const MainCityBarracksPostPanel = lazy(() => import('@/components/garrison/MainCityBarracksPostPanel'));
const SanGongFuPanel = lazy(() => import('@/components/game/SanGongFuPanel'));
import PositionCard from '@shared/components/card/PositionCard';
import StrategicWorldMapSection from '@/components/world/StrategicWorldMapSection';
import WorldMapAlertOverlays from '@/components/world/WorldMapAlertOverlays';
import WorldMapBattlePortal from '@/components/world/WorldMapBattlePortal';
import { worldMapOverlayRefs, notifyWorldMapOverlayGate } from '@/utils/worldMapOverlayRefs';
import { imperialMarchNpcToAllyUnit } from '@/utils/imperialMarchSiegeAlly';

export default function WorldMap({
  onEventBusyChange,
  sanGongFuCardPool,
  /** 特色介绍层展示中时勿触发教程链 IDLE 自动探索（避免叠层竞态） */
  blockTutorialAutoplay = false,
}) {
  const { player, cards, attributeBonusBySlot, refresh: refreshPlayer } = usePlayerContext();
  const skillsMap = useSkillsMap();
  const battlePlayerUnits = useMemo(
    () => buildPlayerUnitsFromContext(player, cards, attributeBonusBySlot, skillsMap),
    [player, cards, attributeBonusBySlot, skillsMap],
  );

  /** 大地图挂载后预取战术图分包，减少首次攻城/匪寨/探索战的等待 */
  useEffect(() => {
    void import('@/components/battle/BattleArena');
  }, []);

  const roadFriction = useRoadDefenseFriction();
  /** 与 `StrategicWorldMapSection` 同步：战略格网 + 郡内城行，供探索锚点在「路格≠库锚格」时用 footprint 反查 city_id */
  const exploreAnchorGridRef = useRef(null);
  const [exploreAnchorGridSeq, setExploreAnchorGridSeq] = useState(0);
  const onExploreAnchorGridContext = useCallback((ctx) => {
    exploreAnchorGridRef.current = ctx;
    setExploreAnchorGridSeq((n) => n + 1);
  }, []);

  const eventSystem = useEventSystem(player, cards, {
    tutorialAutoplay: !blockTutorialAutoplay,
    suppressMapEventHint: blockTutorialAutoplay,
    persistMapEventHint: true,
    exploreAnchorGridRef,
    exploreAnchorGridSeq,
  });
  const {
    phase,
    mapEventHintDisplay,
    quota,
    eventsLoading,
    explorePoolAt,
    startExplore,
    citiesList,
    itemNameMap,
    isTutorial,
    tutorialExploreStep,
    positionAnimation,
    showLineupGuide,
  } = eventSystem;

  const [simpleAlertMessage, setSimpleAlertMessage] = useState(null);
  const [roadAttackerAlert, setRoadAttackerAlert] = useState(null);

  const pvpActionsRef = useRef({});
  const authoritativeReplayRef = useRef({});
  const bumpStrategicRoadPresenceRef = useRef(null);
  const strategicRoadMarchAnimatingRef = useRef(false);

  const {
    siegeData,
    siegeResult,
    setSiegeResult,
    siegeLoading,
    garrisonStatsRefreshKey,
    bumpGarrisonStats,
    banditRaidData,
    banditRaidResult,
    postBanditRaidRefreshKey,
    banditRaidStartBlockedReason,
    confirmRoadAttackerEnterBattle,
    startSiegeForCity,
    startPvpBaseCampSiege,
    handleBanditRaidStart,
    handleBanditRaidEnd,
    closeBanditRaidResult,
    handleBanditRaidAbandon,
    handleBanditRaidContinue,
    handleSiegeEnd,
    closeSiegeResult,
  } = useWorldMapStrategicBattles({
    player,
    cards,
    phase,
    refreshPlayer,
    setSimpleAlertMessage,
    pvpActionsRef,
    authoritativeReplayRef,
    roadAttackerAlert,
    setRoadAttackerAlert,
    bumpStrategicRoadPresenceRef,
  });

  const imperialMarchAllyUnits = useMemo(() => {
    const u = imperialMarchNpcToAllyUnit(siegeData?.imperialMarchAlly);
    return u ? [u] : [];
  }, [siegeData?.imperialMarchAlly]);

  const {
    pvpChallenge,
    setPvpChallenge,
    pvpCountdown,
    setPvpCountdown,
    pvpDefenseWaiting,
    pvpDefenseOutcome,
    setPvpDefenseOutcome,
    pvpAttackerAdjudicating,
    authoritativeReplayOverlay,
    setAuthoritativeReplayOverlay,
    beginDefenseFollowUp: beginDefenseFollowUpCore,
  } = usePvpSiegeAdjudication({
    playerId: player?.playerId,
    refreshPlayer,
    onGarrisonStatsBump: bumpGarrisonStats,
    setSiegeResult,
    setSimpleAlertMessage,
  });

  pvpActionsRef.current = { setPvpChallenge, setPvpCountdown };
  authoritativeReplayRef.current = { setAuthoritativeReplayOverlay };

  const {
    showGarrison,
    garrisonCityId,
    garrisonCityName,
    showBarracksPost,
    barracksPostCityId,
    barracksPostCityName,
    showSanGongFu,
    sanGongFuCityName,
    sanGongPositionAnim,
    onDuty,
    playerMainCityIdForUi,
    handleToggleDutyForCity,
    handleSetMainCityRequest,
    handleOpenBarracksPost,
    handleOpenSanGongFu,
    handleSanGongPromoted,
    openGarrisonForCity,
    bumpStrategicMapRuntimeCaches,
    closeGarrisonPanel,
    closeBarracksPostPanel,
    closeSanGongFuPanel,
    strategicFullScreenOverlayOpen,
  } = useWorldMapCityPanels({
    player,
    refreshPlayer,
    setSimpleAlertMessage,
    bumpGarrisonStats,
  });

  const { subsidiaryExploreEmbed } = useWorldMapExploreSubsidiary({
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
  });

  const {
    alert: pvpDefenseAlert,
    dismiss: dismissPvpDefenseAlert,
    reset: resetPvpDefenseSilence,
  } = usePvpDefenseAlertPoll({ playerId: player?.playerId, enabled: !!onDuty });

  const pvpSiegeNowTick = useCountdownTicker(!!pvpChallenge?.countdownEndsAt);

  const roadNoticeUiBlockRef = useRef({
    authoritativeReplayOverlay: false,
    siegeResult: false,
    siegeData: false,
    banditRaidData: false,
    banditRaidResult: false,
    roadAuthoritativeOutcomeModal: false,
    pvpAttackerAdjudicating: false,
    pvpDefenseOutcome: false,
    roadAttackerAlert: false,
    pvpChallenge: false,
    roadDefenseAlert: false,
    roadAwaitingAuthoritativeOutcome: false,
    roadDefenseOutcomeReplay: false,
  });
  const { roadGateRetreatNotice, setRoadGateRetreatNotice } = useRoadSelfPresencePoll({
    playerId: player?.playerId,
    refreshPlayer,
    blockTutorialAutoplay,
    roadNoticeUiBlockRef,
    roadDefenseOutcomeReplayBlockingRef: roadFriction.roadDefenseOutcomeReplayBlockingRef,
    bumpStrategicRoadPresenceRef,
    strategicRoadMarchAnimatingRef,
    noticeUnblockDeps: [
      authoritativeReplayOverlay,
      siegeResult,
      siegeData,
      roadFriction.roadAuthoritativeOutcomeModal,
      pvpAttackerAdjudicating,
      pvpDefenseOutcome,
      roadAttackerAlert,
      pvpChallenge,
      roadFriction.roadDefenseAlert,
      roadFriction.roadAwaitingAuthoritativeOutcome,
      roadFriction.roadDefenseAuthoritativeReplayOpen,
      banditRaidData,
      banditRaidResult,
    ],
  });

  useEffect(() => {
    worldMapOverlayRefs.worldMapMounted = true;
    worldMapOverlayRefs.pvpDefenseAlertActive = !!pvpDefenseAlert;
    worldMapOverlayRefs.siegeRoadEncounterId = siegeData?.roadEncounterId ?? null;
    notifyWorldMapOverlayGate();
    return () => {
      worldMapOverlayRefs.worldMapMounted = false;
      worldMapOverlayRefs.pvpDefenseAlertActive = false;
      worldMapOverlayRefs.siegeRoadEncounterId = null;
      notifyWorldMapOverlayGate();
    };
  }, [pvpDefenseAlert, siegeData?.roadEncounterId]);

  const beginDefenseFollowUp = useCallback(
    (alert) => beginDefenseFollowUpCore(alert, dismissPvpDefenseAlert),
    [beginDefenseFollowUpCore, dismissPvpDefenseAlert],
  );

  useEffect(() => {
    const id = pvpDefenseAlert?.challengeId;
    if (!id || !pvpDefenseAlert?.waitSeconds) return undefined;
    const sec = Math.min(60, Math.max(1, Number(pvpDefenseAlert.waitSeconds)));
    const snap = { ...pvpDefenseAlert };
    const t = setTimeout(() => beginDefenseFollowUp(snap), sec * 1000);
    return () => clearTimeout(t);
  }, [pvpDefenseAlert?.challengeId, pvpDefenseAlert?.waitSeconds, beginDefenseFollowUp]);

  // 通知父组件事件是否进行中（隐藏底部Tab）
  useEffect(() => {
    const busy = [PHASE.EVENT, PHASE.ROLLING, PHASE.RESULT, PHASE.BATTLE, PHASE.REWARD, PHASE.MINIGAME, PHASE.RETURNING].includes(phase)
      || !!siegeData
      || !!banditRaidData
      || !!banditRaidResult
      || !!pvpChallenge
      || !!pvpDefenseWaiting
      || !!pvpAttackerAdjudicating
      || !!roadAttackerAlert
      || !!authoritativeReplayOverlay
      || roadFriction.roadDefenseAuthoritativeReplayOpen;
    onEventBusyChange?.(busy);
  }, [
    phase,
    onEventBusyChange,
    siegeData,
    banditRaidData,
    banditRaidResult,
    pvpChallenge,
    pvpDefenseWaiting,
    pvpAttackerAdjudicating,
    roadAttackerAlert,
    authoritativeReplayOverlay,
    roadFriction.roadDefenseAuthoritativeReplayOpen,
  ]);

  useEffect(
    () => () => {
      onEventBusyChange?.(false);
    },
    [onEventBusyChange],
  );

  /** 攻城/探索/道路等全屏或模态流程中不渲染大地图 event_hint portal，避免「指引」压在战斗或弹窗之上 */
  const strategicMapEventHintSuppressed =
    blockTutorialAutoplay ||
    !!siegeData ||
    !!siegeResult ||
    !!banditRaidData ||
    !!banditRaidResult ||
    !!pvpChallenge ||
    !!pvpDefenseWaiting ||
    !!roadAttackerAlert ||
    !!authoritativeReplayOverlay ||
    roadFriction.roadDefenseAuthoritativeReplayOpen ||
    [
      PHASE.EVENT,
      PHASE.ROLLING,
      PHASE.RESULT,
      PHASE.BATTLE,
      PHASE.REWARD,
      PHASE.MINIGAME,
      PHASE.RETURNING,
    ].includes(phase);

  const pvpCountdownDisplay = useMemo(() => {
    if (!pvpChallenge?.countdownEndsAt) return Math.max(0, Number(pvpCountdown) || 0);
    return Math.max(0, Math.ceil((pvpChallenge.countdownEndsAt - pvpSiegeNowTick) / 1000));
  }, [pvpChallenge, pvpCountdown, pvpSiegeNowTick]);

  roadNoticeUiBlockRef.current = {
    authoritativeReplayOverlay:
      !!authoritativeReplayOverlay || roadFriction.roadDefenseAuthoritativeReplayOpen,
    siegeResult: !!siegeResult,
    siegeData: !!siegeData,
    banditRaidData: !!banditRaidData,
    banditRaidResult: !!banditRaidResult,
    roadAuthoritativeOutcomeModal: roadFriction.roadAuthoritativeOutcomeModal,
    pvpAttackerAdjudicating: !!pvpAttackerAdjudicating,
    pvpDefenseOutcome: !!pvpDefenseOutcome,
    roadAttackerAlert: !!roadAttackerAlert,
    pvpChallenge: !!pvpChallenge,
    roadDefenseAlert: roadFriction.roadDefenseAlert,
    roadAwaitingAuthoritativeOutcome: roadFriction.roadAwaitingAuthoritativeOutcome,
    roadDefenseOutcomeReplay: !!roadFriction.roadDefenseOutcomeReplayBlockingRef.current,
  };

  return (
    <div className="relative flex flex-col h-full min-h-0 w-full bg-stone-950">
      <StrategicWorldMapSection
        className="flex-1 min-h-0 h-full"
        bumpStrategicRoadPresenceRef={bumpStrategicRoadPresenceRef}
        onRoadMarchAnimatingChange={(animating) => {
          strategicRoadMarchAnimatingRef.current = !!animating;
        }}
        strategicFullScreenOverlayOpen={strategicFullScreenOverlayOpen}
        strategicMapEventHintSuppressed={strategicMapEventHintSuppressed}
        pendingMapEventHint={mapEventHintDisplay}
        playerId={player?.playerId}
        playerFactionId={player?.factionId}
        siegeLoading={siegeLoading}
        onStartSiegeForCity={startSiegeForCity}
        onRoadEncounterBattle={(enc) => {
          if (enc?.encounterId) setRoadAttackerAlert(enc);
        }}
        garrisonStatsRefreshKey={garrisonStatsRefreshKey}
        playerOnDuty={!!player?.onDuty}
        playerOnDutyCityId={player?.onDuty_city_id ?? null}
        playerMainCityId={playerMainCityIdForUi}
        playerMainCityChangedAt={player?.mainCityChangedAt ?? null}
        playerSilver={player?.silver ?? null}
        onSetMainCityRequest={handleSetMainCityRequest}
        onSetMainCityError={setSimpleAlertMessage}
        onOpenBarracksPost={handleOpenBarracksPost}
        onOpenSanGongFu={handleOpenSanGongFu}
        onOpenGarrisonForCity={openGarrisonForCity}
        onToggleDutyForCity={handleToggleDutyForCity}
        onDutyError={setSimpleAlertMessage}
        subsidiaryExploreEmbed={subsidiaryExploreEmbed}
        onExploreAnchorGridContext={onExploreAnchorGridContext}
        onStartBanditRaid={handleBanditRaidStart}
        banditRaidStartBlockedReason={banditRaidStartBlockedReason}
        postBanditRaidRefreshKey={postBanditRaidRefreshKey}
        strategicTutorialExploreStep={tutorialExploreStep}
        onStartPvpBaseCampSiege={startPvpBaseCampSiege}
      />

      <WorldMapAlertOverlays
        pvpChallenge={pvpChallenge}
        pvpCountdownDisplay={pvpCountdownDisplay}
        pvpAttackerAdjudicating={pvpAttackerAdjudicating}
        pvpDefenseWaiting={pvpDefenseWaiting}
        pvpDefenseOutcome={pvpDefenseOutcome}
        onPvpDefenseOutcomeClose={() => {
          resetPvpDefenseSilence();
          setPvpDefenseOutcome(null);
        }}
        authoritativeReplayOverlay={authoritativeReplayOverlay}
        onAuthoritativeReplayClose={() => setAuthoritativeReplayOverlay(null)}
        roadAttackerAlert={roadAttackerAlert}
        onRoadAttackerConfirm={confirmRoadAttackerEnterBattle}
        onRoadAttackerClose={() => setRoadAttackerAlert(null)}
        roadGateRetreatNotice={roadGateRetreatNotice}
        onRoadGateNoticeClose={() => setRoadGateRetreatNotice(null)}
        showRoadGateNotice={
          !siegeData &&
          !banditRaidData &&
          !banditRaidResult &&
          !roadFriction.roadDefenseAlert &&
          !pvpDefenseAlert &&
          !roadAttackerAlert
        }
        pvpDefenseAlert={pvpDefenseAlert}
        onPvpDefenseAlertConfirm={() => beginDefenseFollowUp(pvpDefenseAlert)}
        simpleAlertMessage={simpleAlertMessage}
        onSimpleAlertClose={() => setSimpleAlertMessage(null)}
        siegeData={siegeData}
        banditRaidData={banditRaidData}
        banditRaidResult={banditRaidResult}
      />

      {/* ── 驻地编组面板 ── */}
      {showGarrison && garrisonCityId ? (
        <Suspense fallback={<ChunkLoadFallback label="编组面板加载中…" />}>
          <GarrisonLineup
            onClose={closeGarrisonPanel}
            onAfterMutation={bumpStrategicMapRuntimeCaches}
            cityId={garrisonCityId}
            cityName={garrisonCityName || '城池'}
          />
        </Suspense>
      ) : null}

      {showBarracksPost && barracksPostCityId ? (
        <Suspense fallback={<ChunkLoadFallback label="军营面板加载中…" />}>
          <MainCityBarracksPostPanel
            cityId={barracksPostCityId}
            cityName={barracksPostCityName || '城池'}
            onClose={closeBarracksPostPanel}
            onAfterSave={bumpStrategicMapRuntimeCaches}
          />
        </Suspense>
      ) : null}

      {showSanGongFu ? (
        <Suspense fallback={<ChunkLoadFallback label="三公府加载中…" />}>
          <SanGongFuPanel
            cityName={sanGongFuCityName || '城池'}
            onClose={closeSanGongFuPanel}
            onPromoted={handleSanGongPromoted}
            sanGongFuCardPool={sanGongFuCardPool}
          />
        </Suspense>
      ) : null}

      {sanGongPositionAnim?.position ? (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/65 px-4">
          <div className="mb-3 text-center text-amber-400 text-lg font-bold">官职授予</div>
          <div style={{ transform: 'scale(0.72)', transformOrigin: 'center center' }}>
            <PositionCard position={sanGongPositionAnim.position} showDetails />
          </div>
        </div>
      ) : null}

      <WorldMapBattlePortal
        open={
          !!(siegeData && !siegeResult) || !!siegeResult || !!banditRaidData || !!banditRaidResult
        }
        banditRaidData={banditRaidData}
        siegeData={siegeData}
        siegeResult={siegeResult}
        banditRaidResult={banditRaidResult}
        battlePlayerUnits={battlePlayerUnits}
        cards={cards}
        player={player}
        imperialMarchAllyUnits={imperialMarchAllyUnits}
        onBanditBattleEnd={handleBanditRaidEnd}
        onSiegeBattleEnd={handleSiegeEnd}
        onCloseSiegeResult={closeSiegeResult}
        onCloseBanditResult={closeBanditRaidResult}
        onBanditContinue={handleBanditRaidContinue}
        onBanditDefeatAbandon={handleBanditRaidAbandon}
      />

      {/* 官职装配动画（教程链事件获得官职后） */}
      {positionAnimation && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
          <div className="text-center animate-bounce">
            <div className="text-6xl mb-4">👑</div>
            <div className="text-amber-400 text-2xl font-bold mb-2">
              官职授予
            </div>
            <div className="text-white text-lg">
              {positionAnimation.positionName}
            </div>
            <div className="text-amber-300/60 text-sm mt-2">
              Lv.{positionAnimation.positionLevel}
            </div>
          </div>
        </div>
      )}

      {/* 编组引导（指引叁前需至少 1 支部队） */}
      {showLineupGuide && (
        <div className="fixed inset-0 z-[150] pointer-events-none">
          {/* 半透明遮罩 */}
          <div className="absolute inset-0 bg-black/40" />
          {/* 提示文字 */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-center pointer-events-auto">
            <div className="bg-stone-900/90 border border-amber-500/50 rounded-xl px-6 py-4 shadow-2xl">
              <div className="text-amber-400 text-lg font-bold mb-2">⚔️ 编组部队</div>
              <div className="text-stone-300 text-sm mb-1">在继续征程之前，先装备你的将领和部队吧！</div>
              <div className="text-stone-400 text-xs">至少装备 1 支部队</div>
            </div>
          </div>
          {/* 指向左下角编组按钮的箭头 */}
          <div className="absolute bottom-20 left-24 pointer-events-none animate-bounce">
            <div className="text-4xl">👇</div>
            <div className="text-amber-400 text-xs font-bold mt-1">点击编组</div>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <ExplorePanel eventSystem={eventSystem} />
      </Suspense>
    </div>
  );
}
