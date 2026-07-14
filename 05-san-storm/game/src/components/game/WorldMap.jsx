/**
 * 大地图：郡级战略格网（world，默认颍川，可通过州郡条切换汝南等已产出 `merged.json` 的郡）；攻城/城况/荒郊等经格上 tooltip 与共享面板。
 */

import { useState, useRef, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useRoadDefenseFriction } from '@/contexts/RoadDefenseFrictionContext';
import { useSkillsMap } from '@/hooks/useSkillsMap';
import useEventSystem from '@/hooks/useEventSystem';
import { PHASE } from '@/components/event/EventConstants';
import ChunkLoadFallback from '@/components/game/ChunkLoadFallback';
import { buildPlayerUnitsFromContext } from '@/utils/battlePlayerBuilder';
import { useCountdownTicker } from '@/hooks/useCountdownTicker';
import { useRoadSelfPresencePoll, enqueueRoadGateRetreatNotice } from '@/hooks/useRoadSelfPresencePoll';
import { usePvpSiegeAdjudication } from '@/hooks/usePvpSiegeAdjudication';
import { useWorldMapStrategicBattles } from '@/hooks/useWorldMapStrategicBattles';
import CeremonyBounceOverlay from '@/components/game/CeremonyBounceOverlay';
import { useWorldMapCityPanels } from '@/hooks/useWorldMapCityPanels';
import { useWorldMapExploreSubsidiary } from '@/hooks/useWorldMapExploreSubsidiary';
const ExplorePanel = lazy(() => import('@/components/event/ExplorePanel'));
const MainCityBarracksHub = lazy(() => import('@/components/garrison/MainCityBarracksHub'));
const SanGongFuPanel = lazy(() => import('@/components/game/SanGongFuPanel'));
import PositionCard from '@shared/components/card/PositionCard';
import StrategicWorldMapSection from '@/components/world/StrategicWorldMapSection';
import WorldMapAlertOverlays from '@/components/world/WorldMapAlertOverlays';
import WorldMapBattlePortal from '@/components/world/WorldMapBattlePortal';
import StrategicSettlementCard from '@/components/world/StrategicSettlementCard';
import { mapRoadEncounterOutcomeToSettlementProps } from '@/utils/roadEncounterSettlement';
import { worldMapOverlayRefs, notifyWorldMapOverlayGate } from '@/utils/worldMapOverlayRefs';
import { imperialMarchNpcToAllyUnit } from '@/utils/imperialMarchSiegeAlly';

export default function WorldMap({
  onEventBusyChange,
  sanGongFuCardPool,
  /** 特色介绍层展示中时勿触发教程链 IDLE 自动探索（避免叠层竞态） */
  blockTutorialAutoplay = false,
  /** 待领取赛季继承时隐藏探索/事件 UI，须先于结算弹窗确认 */
  suppressExploreUi = false,
  /** 底栏在大地图 Tab（activeTab=null）时为 true；为 false 时不渲染 event_hint portal */
  mapLayerVisible = true,
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
  const exploreAnchorRoadOverrideRef = useRef(null);
  const [exploreAnchorRoadOverrideSeq, setExploreAnchorRoadOverrideSeq] = useState(0);
  const setExploreAnchorRoadOverride = useCallback((override) => {
    exploreAnchorRoadOverrideRef.current = override;
    setExploreAnchorRoadOverrideSeq((n) => n + 1);
  }, []);
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
    exploreAnchorRoadOverrideRef,
    exploreAnchorRoadOverrideSeq,
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
    closeEvent,
    retryTutorialExploreAutoplay,
  } = eventSystem;

  const [simpleAlertMessage, setSimpleAlertMessage] = useState(null);

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
    startSiegeForCity,
    startPvpBaseCampSiege,
    handleBanditRaidStart,
    handleBanditRaidEnd,
    closeBanditRaidResult,
    handleBanditRaidAbandon,
    handleBanditRaidContinue,
    handleSiegeEnd,
    closeSiegeResult,
    handleSiegeContinue,
  } = useWorldMapStrategicBattles({
    player,
    cards,
    phase,
    refreshPlayer,
    setSimpleAlertMessage,
    pvpActionsRef,
    authoritativeReplayRef,
    roadAttackerAlert: null,
    setRoadAttackerAlert: () => {},
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
    pvpDefenseSettlementRaw,
    setPvpDefenseSettlementRaw,
    pvpAttackerAdjudicating,
    authoritativeReplayOverlay,
    setAuthoritativeReplayOverlay,
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
    showBarracksPost,
    barracksPostCityId,
    barracksPostCityName,
    showSanGongFu,
    sanGongFuCityName,
    sanGongPositionAnim,
    playerMainCityIdForUi,
    handleSetMainCityRequest,
    handleOpenBarracksPost,
    handleOpenSanGongFu,
    handleSanGongPromoted,
    bumpStrategicMapRuntimeCaches,
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

  const pvpSiegeNowTick = useCountdownTicker(!!pvpChallenge?.countdownEndsAt);

  const roadNoticeUiBlockRef = useRef({
    authoritativeReplayOverlay: false,
    siegeResult: false,
    siegeData: false,
    banditRaidData: false,
    banditRaidResult: false,
    roadAuthoritativeOutcomeModal: false,
    pvpAttackerAdjudicating: false,
    pvpDefenseSettlement: false,
    roadAttackerAlert: false,
    roadAttackerAdjudicating: false,
    pvpChallenge: false,
    roadDefenseAlert: false,
    roadAwaitingAuthoritativeOutcome: false,
    roadDefenseOutcomeReplay: false,
  });

  const { roadGateRetreatNotice, setRoadGateRetreatNotice, deferredRoadGateNoticeRef } =
    useRoadSelfPresencePoll({
    playerId: player?.playerId,
    refreshPlayer,
    blockTutorialAutoplay,
    roadNoticeUiBlockRef,
    roadDefenseOutcomeReplayBlockingRef: roadFriction.roadDefenseOutcomeReplayBlockingRef,
    bumpStrategicRoadPresenceRef,
    strategicRoadMarchAnimatingRef,
    onAttackerFightingEncounterResume: undefined,
    noticeUnblockDeps: [
      authoritativeReplayOverlay,
      siegeResult,
      siegeData,
      roadFriction.roadAuthoritativeOutcomeModal,
      pvpAttackerAdjudicating,
      pvpDefenseSettlementRaw,
      pvpChallenge,
      roadFriction.roadDefenseAlert,
      roadFriction.roadAwaitingAuthoritativeOutcome,
      roadFriction.roadDefenseAuthoritativeReplayOpen,
      banditRaidData,
      banditRaidResult,
    ],
  });

  useEffect(() => {
    worldMapOverlayRefs.enqueueRoadGateNotice = (text) => {
      enqueueRoadGateRetreatNotice(text, {
        setRoadGateRetreatNotice,
        deferredRoadGateNoticeRef,
        blockSnapshot: roadNoticeUiBlockRef.current,
        blockTutorialAutoplay,
        roadDefenseOutcomeReplayBlockingRef: roadFriction.roadDefenseOutcomeReplayBlockingRef,
      });
    };
    return () => {
      worldMapOverlayRefs.enqueueRoadGateNotice = null;
    };
  });

  useEffect(() => {
    worldMapOverlayRefs.worldMapMounted = true;
    worldMapOverlayRefs.pvpDefenseAlertActive = false;
    worldMapOverlayRefs.siegeRoadEncounterId = siegeData?.roadEncounterId ?? null;
    notifyWorldMapOverlayGate();
    return () => {
      worldMapOverlayRefs.worldMapMounted = false;
      worldMapOverlayRefs.pvpDefenseAlertActive = false;
      worldMapOverlayRefs.siegeRoadEncounterId = null;
      notifyWorldMapOverlayGate();
    };
  }, [siegeData?.roadEncounterId]);

  // 通知父组件事件是否进行中（隐藏底部Tab）
  useEffect(() => {
    const busy = [PHASE.EVENT, PHASE.ROLLING, PHASE.RESULT, PHASE.BATTLE, PHASE.REWARD, PHASE.MINIGAME, PHASE.RETURNING].includes(phase)
      || !!siegeData
      || !!banditRaidData
      || !!banditRaidResult
      || !!pvpChallenge
      || !!pvpDefenseWaiting
      || !!pvpAttackerAdjudicating
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
    authoritativeReplayOverlay,
    roadFriction.roadDefenseAuthoritativeReplayOpen,
  ]);

  useEffect(
    () => () => {
      onEventBusyChange?.(false);
    },
    [onEventBusyChange],
  );

  /** 待领取赛季继承：关闭已弹出的教程/探索事件，避免 AncientModal 盖住结算窗 */
  useEffect(() => {
    if (!suppressExploreUi) return;
    if (phase !== PHASE.IDLE) closeEvent();
  }, [suppressExploreUi, phase, closeEvent]);

  /** 攻城/探索/道路等全屏或模态流程中不在左上展示 event_hint（32-4 §1.5） */
  const strategicMapEventHintSuppressed =
    !mapLayerVisible ||
    blockTutorialAutoplay ||
    suppressExploreUi ||
    !!siegeData ||
    !!siegeResult ||
    !!banditRaidData ||
    !!banditRaidResult ||
    !!pvpChallenge ||
    !!pvpDefenseWaiting ||
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
    pvpDefenseSettlement: !!pvpDefenseSettlementRaw,
    roadAttackerAlert: false,
    roadAttackerAdjudicating: false,
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
        onRoadEncounterBattle={undefined}
        garrisonStatsRefreshKey={garrisonStatsRefreshKey}
        playerMainCityId={playerMainCityIdForUi}
        playerMainCityChangedAt={player?.mainCityChangedAt ?? null}
        playerSilver={player?.silver ?? null}
        onSetMainCityRequest={handleSetMainCityRequest}
        onSetMainCityError={setSimpleAlertMessage}
        onOpenBarracksPost={handleOpenBarracksPost}
        onOpenSanGongFu={handleOpenSanGongFu}
        subsidiaryExploreEmbed={subsidiaryExploreEmbed}
        onExploreAnchorGridContext={onExploreAnchorGridContext}
        setExploreAnchorRoadOverride={setExploreAnchorRoadOverride}
        onExploreAnchorSettled={retryTutorialExploreAutoplay}
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
        authoritativeReplayOverlay={authoritativeReplayOverlay}
        onAuthoritativeReplayClose={() => setAuthoritativeReplayOverlay(null)}
        roadAttackerAlert={null}
        roadAttackerCountdown={0}
        onRoadAttackerConfirm={undefined}
        roadGateRetreatNotice={roadGateRetreatNotice}
        onRoadGateNoticeClose={() => setRoadGateRetreatNotice(null)}
        showRoadGateNotice={
          !siegeData &&
          !siegeResult &&
          !banditRaidData &&
          !banditRaidResult &&
          !roadFriction.roadDefenseAlert &&
          !roadFriction.roadDefenseAuthoritativeReplayOpen &&
          !roadFriction.roadAuthoritativeOutcomeModal &&
          !roadFriction.roadAwaitingAuthoritativeOutcome
        }
        simpleAlertMessage={simpleAlertMessage}
        onSimpleAlertClose={() => setSimpleAlertMessage(null)}
        siegeData={siegeData}
        banditRaidData={banditRaidData}
        banditRaidResult={banditRaidResult}
      />

      {/* ── 主城驻军所（驻地编组 + 军营与仓库） ── */}
      {showBarracksPost && barracksPostCityId ? (
        <Suspense fallback={<ChunkLoadFallback label="驻军所加载中…" />}>
          <MainCityBarracksHub
            cityId={barracksPostCityId}
            cityName={barracksPostCityName || '城池'}
            onClose={closeBarracksPostPanel}
            onAfterMutation={bumpStrategicMapRuntimeCaches}
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

      {typeof document !== 'undefined' &&
        pvpDefenseSettlementRaw &&
        !authoritativeReplayOverlay &&
        createPortal(
          <div className="pointer-events-auto fixed inset-0 z-[235] flex min-h-0 flex-col">
            <StrategicSettlementCard
              {...mapRoadEncounterOutcomeToSettlementProps(pvpDefenseSettlementRaw)}
              onConfirm={() => {
                setPvpDefenseSettlementRaw(null);
              }}
            />
          </div>,
          document.body,
        )}

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
        onSiegeContinue={handleSiegeContinue}
      />

      {positionAnimation ? (
        <CeremonyBounceOverlay
          icon="👑"
          title="官职授予"
          subtitle={positionAnimation.positionName}
          caption={`Lv.${positionAnimation.positionLevel}`}
        />
      ) : null}

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

      {!suppressExploreUi ? (
        <Suspense fallback={null}>
          <ExplorePanel eventSystem={eventSystem} />
        </Suspense>
      ) : null}
    </div>
  );
}
