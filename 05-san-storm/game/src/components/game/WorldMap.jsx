/**
 * 大地图：郡级战略格网（world，默认颍川，可通过州郡条切换汝南等已产出 `merged.json` 的郡）；攻城/城况/荒郊等经格上 tooltip 与共享面板。
 */

import { useState, useRef, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useRoadDefenseFriction } from '@/contexts/RoadDefenseFrictionContext';
import { useSkillsMap } from '@/hooks/useSkillsMap';
import useEventSystem from '@/hooks/useEventSystem';
import ChunkLoadFallback from '@/components/game/ChunkLoadFallback';
import { buildPlayerUnitsFromContext } from '@/utils/battlePlayerBuilder';
import { clearInflightBattleTroopSnapshot } from '@/utils/inflightBattleTroopSnapshot';
import { fetchSiegeQuotaJson, postSiegeQuotaAction } from '@/hooks/useSiegeQuota';
import { PHASE } from '@/components/event/EventConstants';
import { playerAPI } from '@/services/playerApi';
import { fetchWithTimeout } from '@/services/httpClient';
import { usePvpDefenseAlertPoll } from '@/hooks/usePvpDefenseAlertPoll';
import { useCountdownTicker } from '@/hooks/useCountdownTicker';
import { useRoadSelfPresencePoll } from '@/hooks/useRoadSelfPresencePoll';
import { usePvpSiegeAdjudication } from '@/hooks/usePvpSiegeAdjudication';
const ExplorePanel = lazy(() => import('@/components/event/ExplorePanel'));
const GarrisonLineup = lazy(() => import('@/components/garrison/GarrisonLineup'));
const MainCityBarracksPostPanel = lazy(() => import('@/components/garrison/MainCityBarracksPostPanel'));
const SanGongFuPanel = lazy(() => import('@/components/game/SanGongFuPanel'));
import PositionCard from '@shared/components/card/PositionCard';
import { garrisonAPI } from '@/services/garrisonApi';
import { warAPI } from '@/services/warApi';
import { API_CONFIG } from '@/constants';
import { validateMainLineupBattleGate } from '@/utils/mainLineupTroops';
import { buildBanditLayerSmallMapPveLoot } from '@shared/utils/banditRaidLayerRewards';
import { banditNpcSlotRaritiesFromLayer } from '@shared/utils/smallMapEnemyRoster';
import {
  getConfiguredGarrisonCityIds,
  MAX_GARRISON_CONFIGURED_CITIES,
} from '@/utils/garrisonScopeUtils';
import StrategicWorldMapSection from '@/components/world/StrategicWorldMapSection';
import WorldMapAlertOverlays from '@/components/world/WorldMapAlertOverlays';
import WorldMapBattlePortal from '@/components/world/WorldMapBattlePortal';
import { worldMapCityIsPlayerSameFaction } from '@/utils/worldMapCityPanelCopy';
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

  // ── 城市攻城状态 ──
  const [siegeData, setSiegeData] = useState(null); // 非null时进入战斗
  const imperialMarchAllyUnits = useMemo(() => {
    const u = imperialMarchNpcToAllyUnit(siegeData?.imperialMarchAlly);
    return u ? [u] : [];
  }, [siegeData?.imperialMarchAlly]);
  const [siegeResult, setSiegeResult] = useState(null); // 战斗结算
  const [siegeLoading, setSiegeLoading] = useState(false);
  /** 驻守统计全图拉取在 `StrategicWorldMapSection`；披挂等操作后 bump 以刷新格上 tooltip 用槽数 */
  const [garrisonStatsRefreshKey, setGarrisonStatsRefreshKey] = useState(0);
  /** 匪寨小型图战斗：与攻城互斥；payload 见 `handleBanditRaidStart` */
  const [banditRaidData, setBanditRaidData] = useState(null);
  /** 匪寨战后结算面板（与攻城 `siegeResult` 同层 portal，点确定后关闭） */
  const [banditRaidResult, setBanditRaidResult] = useState(null);
  /** 匪寨战后 bump：战略 tooltip 内 `useBanditRaidQuota` 主动刷新 */
  const [postBanditRaidRefreshKey, setPostBanditRaidRefreshKey] = useState(0);
  const banditRaidDataRef = useRef(null);
  useEffect(() => {
    banditRaidDataRef.current = banditRaidData;
  }, [banditRaidData]);

  const banditRaidStartBlockedReason = useMemo(() => {
    const phaseOk = phase === PHASE.IDLE || phase === PHASE.RETURNING;
    if (!phaseOk) return '当前处于事件/探索流程中，请返回空闲后再攻打匪寨';
    if (siegeData) return '已有攻城或结算占用，请先结束上一场';
    if (banditRaidData) return '匪寨战斗进行中';
    if (banditRaidResult) return '请先关闭上一场匪寨结算';
    return null;
  }, [phase, siegeData, banditRaidData, banditRaidResult]);

  // ── 驻地编组面板（由格上 tooltip「驻地编组」打开，必带 cityId） ──
  const [showGarrison, setShowGarrison] = useState(false);
  const [garrisonCityId, setGarrisonCityId] = useState(null);
  const [garrisonCityName, setGarrisonCityName] = useState('');
  const [showBarracksPost, setShowBarracksPost] = useState(false);
  const [barracksPostCityId, setBarracksPostCityId] = useState(null);
  const [barracksPostCityName, setBarracksPostCityName] = useState('');
  const [showSanGongFu, setShowSanGongFu] = useState(false);
  const [sanGongFuCityName, setSanGongFuCityName] = useState('');
  const [sanGongPositionAnim, setSanGongPositionAnim] = useState(null);
  const sanGongAnimTimerRef = useRef(null);
  const [onDuty, setOnDuty] = useState(false); // 玩家是否处于披挂待命（任意城）

  const [simpleAlertMessage, setSimpleAlertMessage] = useState(null);
  const [pendingMainCityCityId, setPendingMainCityCityId] = useState(null);
  const [roadAttackerAlert, setRoadAttackerAlert] = useState(null);

  const bumpGarrisonStats = useCallback(() => {
    setGarrisonStatsRefreshKey((k) => k + 1);
  }, []);

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
    playerId: player?.player_id,
    refreshPlayer,
    onGarrisonStatsBump: bumpGarrisonStats,
    setSiegeResult,
    setSimpleAlertMessage,
  });

  const {
    alert: pvpDefenseAlert,
    dismiss: dismissPvpDefenseAlert,
    reset: resetPvpDefenseSilence,
  } = usePvpDefenseAlertPoll({ playerId: player?.player_id, enabled: !!onDuty });

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
  const bumpStrategicRoadPresenceRef = useRef(null);
  const strategicRoadMarchAnimatingRef = useRef(false);

  const { roadGateRetreatNotice, setRoadGateRetreatNotice } = useRoadSelfPresencePoll({
    playerId: player?.player_id,
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

  useEffect(() => {
    if (player?.on_duty == null) return;
    setOnDuty(!!player.on_duty);
  }, [player?.on_duty]);

  useEffect(() => {
    if (pendingMainCityCityId == null) return;
    const cur = player?.main_city_id;
    if (cur != null && String(cur) === String(pendingMainCityCityId)) {
      setPendingMainCityCityId(null);
    }
  }, [player?.main_city_id, pendingMainCityCityId]);

  const playerMainCityIdForUi =
    pendingMainCityCityId != null ? pendingMainCityCityId : (player?.main_city_id ?? null);

  const handleToggleDutyForCity = useCallback(async (cityId, newVal) => {
    if (!player?.player_id) return false;
    const res = await garrisonAPI.setOnDuty(player.player_id, newVal, cityId);
    if (res.success) {
      await refreshPlayer();
      setGarrisonStatsRefreshKey((k) => k + 1);
      return true;
    }
    if (res.error) setSimpleAlertMessage(res.error);
    return false;
  }, [player?.player_id, refreshPlayer]);

  const handleSetMainCityRequest = useCallback(
    async (targetCityId) => {
      if (!player?.player_id || !targetCityId) return;
      try {
        const res = await playerAPI.setMainCity(player.player_id, targetCityId);
        if (res.success) {
          const d = res.data || {};
          let msg;
          if (d.already) {
            msg = '该城已是您的主城（存卡）';
          } else if (Number(d.costSilver) > 0) {
            msg = `已将主城更换为此城，消耗 ${d.costSilver} 银两`;
          } else {
            msg = '已将该城设为主城（存卡仓库）';
          }
          setSimpleAlertMessage(msg);
          setPendingMainCityCityId(String(targetCityId));
          await refreshPlayer({ silent: true });
          return;
        }
        setSimpleAlertMessage(res.error || '设置主城失败');
      } catch (e) {
        setSimpleAlertMessage(e?.message || '设置主城失败');
      }
    },
    [player?.player_id, refreshPlayer],
  );

  /** 主城「驻军所」：军营部队顺序（全屏） */
  const handleOpenBarracksPost = useCallback((cityId, cityBaseName) => {
    if (!cityId) return;
    setBarracksPostCityId(cityId);
    setBarracksPostCityName(cityBaseName || '城池');
    setShowBarracksPost(true);
  }, []);

  /** 大城/中城「三公府」：官职晋升等 */
  const handleOpenSanGongFu = useCallback((_cityId, cityBaseName) => {
    setSanGongFuCityName(cityBaseName || '城池');
    setShowSanGongFu(true);
  }, []);

  const handleSanGongPromoted = useCallback((data) => {
    if (sanGongAnimTimerRef.current) {
      clearTimeout(sanGongAnimTimerRef.current);
      sanGongAnimTimerRef.current = null;
    }
    const pos = data?.position;
    if (pos && typeof pos === 'object') {
      setSanGongPositionAnim({ position: pos, positionName: data.positionName, positionLevel: data.positionLevel });
      sanGongAnimTimerRef.current = setTimeout(() => {
        setSanGongPositionAnim(null);
        sanGongAnimTimerRef.current = null;
      }, 1000);
    }
  }, []);

  useEffect(() => () => {
    if (sanGongAnimTimerRef.current) clearTimeout(sanGongAnimTimerRef.current);
  }, []);

  /** 与攻城结算同源：刷新 `/garrisons/stats/cities` + `/cities`，避免格上 tooltip 驻地槽位 / NPC 等卡旧值 */
  const bumpStrategicMapRuntimeCaches = useCallback(() => {
    setGarrisonStatsRefreshKey((k) => k + 1);
  }, []);

  /** 攻方：弹窗点确定 → 服务端权威推演（与披挂攻城同源），演示后进结算 */
  const confirmRoadAttackerEnterBattle = useCallback(async () => {
    if (!roadAttackerAlert?.encounterId || !player?.player_id) return;
    const eid = roadAttackerAlert.encounterId;
    const gate = validateMainLineupBattleGate({
      cards,
      playerUnits: null,
      playerFood: player?.food ?? 0,
    });
    if (!gate.ok) {
      setSimpleAlertMessage(gate.message);
      return;
    }
    try {
      const res = await playerAPI.resolveRoadEncounterAuthoritative(player.player_id, eid);
      if (!res?.success || !res.data) {
        setSimpleAlertMessage(res?.error || '道路权威结算失败');
        return;
      }
      const d = res.data;
      setRoadAttackerAlert(null);
      const logStr = Array.isArray(d.battleLog) ? d.battleLog.join('\n') : '';
      const siegeResultSnapshot = {
        ...(d.settlement && typeof d.settlement === 'object' ? d.settlement : {}),
        authoritativeBattleLog: d.battleLog,
        battleSeed: d.battleSeed,
        siegeReplayAttackerNames: d.siegeReplayAttackerNames,
        siegeReplayDefenderNames: d.siegeReplayDefenderNames,
        initialAttackerTroops: d.initialAttackerTroops,
        initialDefenderTroops: d.initialDefenderTroops,
      };
      setAuthoritativeReplayOverlay({
        battleLogStr: logStr,
        initialAttackerTroops: d.initialAttackerTroops,
        initialDefenderTroops: d.initialDefenderTroops,
        leftLabel: '攻方',
        rightLabel: '守军',
        onPlaybackComplete: () => {
          setAuthoritativeReplayOverlay(null);
          setSiegeResult(siegeResultSnapshot);
          setGarrisonStatsRefreshKey((k) => k + 1);
          refreshPlayer({ silent: true });
        },
      });
    } catch (e) {
      setSimpleAlertMessage(e?.message || '网络异常');
    }
  }, [roadAttackerAlert, player, cards, refreshPlayer]);

  const openGarrisonForCity = useCallback(async (cityId, cityBaseName) => {
    if (!player?.player_id || !cityId) return;
    try {
      const res = await garrisonAPI.getAll(player.player_id);
      if (!res.success) {
        setSimpleAlertMessage(res.error || '无法加载驻地信息，请稍后重试');
        return;
      }
      const configured = getConfiguredGarrisonCityIds(res.garrisons || []);
      const cid = String(cityId);
      if (!configured.has(cid) && configured.size >= MAX_GARRISON_CONFIGURED_CITIES) {
        setSimpleAlertMessage(
          `已达驻地编组城池上限（${MAX_GARRISON_CONFIGURED_CITIES} 座）。请先在其它城池清空驻地编组，再在本城编组。`
        );
        return;
      }
      setGarrisonCityId(cityId);
      setGarrisonCityName(cityBaseName || '城池');
      setShowGarrison(true);
    } catch (e) {
      setSimpleAlertMessage(e?.message || '打开驻地编组失败');
    }
  }, [player?.player_id]);

  const startSiegeForCity = useCallback(async (cityId, cityRow) => {
    if (!cityId || !player?.player_id) return;
    const phaseOk = phase === PHASE.IDLE || phase === PHASE.RETURNING;
    if (!phaseOk) {
      setSimpleAlertMessage('当前处于事件/探索流程中，请返回空闲后再发起攻城');
      return;
    }
    if (siegeData) {
      setSimpleAlertMessage('已有战斗或结算占用，请先结束上一场或刷新页面后再试。');
      return;
    }
    if (banditRaidData) {
      setSimpleAlertMessage('匪寨战斗进行中，请先结束上一场后再发起攻城。');
      return;
    }
    if (banditRaidResult) {
      setSimpleAlertMessage('请先关闭匪寨结算面板后再发起攻城。');
      return;
    }
    if (worldMapCityIsPlayerSameFaction(cityRow, player?.faction_id)) return;

    const qRes = await fetchSiegeQuotaJson(player.player_id, cityId);
    if (!qRes.success || !(Number(qRes.data?.remaining) > 0)) {
      setSimpleAlertMessage('攻城次数不足');
      return;
    }

    const gate = validateMainLineupBattleGate({
      cards,
      playerUnits: null,
      playerFood: player?.food ?? 0,
    });
    if (!gate.ok) {
      setSimpleAlertMessage(gate.message);
      return;
    }
    setSiegeLoading(true);
    try {
      // 17-2 §1.4 / §1.9：已占领敌对城走 PVP（wars_pvp）；中立城走 PVE（wars）
      const targetIsOccupied = !!(cityRow && cityRow.faction_id);
      let res;
      let pvpWarIdForResult = null;
      if (targetIsOccupied) {
        const activeRes = await warAPI.getActiveByCity(cityId);
        const pvpWar = activeRes?.success ? activeRes.data : null;
        if (!pvpWar || pvpWar.status !== 'active') {
          setSiegeLoading(false);
          setSimpleAlertMessage(
            '该城已被势力占领，需先由君主宣战、放置攻方大本营进入战事才能发起攻城',
          );
          return;
        }
        const sg = await warAPI.initiateAttackerCitySiege(pvpWar.pvpWarId, player.player_id);
        if (!sg?.success) {
          setSiegeLoading(false);
          setSimpleAlertMessage(sg?.error || '攻城请求失败，请稍后重试');
          return;
        }
        res = { success: true, data: { ...sg.data, playerFaction: player.faction_id } };
        pvpWarIdForResult = pvpWar.pvpWarId;
      } else {
        res = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/cities/${encodeURIComponent(cityId)}/siege`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: player.player_id }),
        }).then(r => r.json());
      }

      if (res.success) {
        await postSiegeQuotaAction(player.player_id, cityId, 'consume');
        const enriched = pvpWarIdForResult
          ? { ...res.data, pvpWarId: pvpWarIdForResult }
          : res.data;

        if (enriched.defenderType === 'pvp_online') {
          try {
            const pvpRes = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/pvp/challenge`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                warId: enriched.warId || null,
                pvpWarId: enriched.pvpWarId || null,
                cityId,
                attackerId: player.player_id,
                attackerFaction: enriched.playerFaction || player.faction_id,
                defenderId: enriched.defenderPlayerId,
                defenderGarrisonSlot: enriched.defenderGarrisonSlot,
              }),
            }).then(r => r.json());
            if (pvpRes.success) {
              const ws = Number(pvpRes.waitSeconds) || 10;
              setPvpChallenge({
                ...pvpRes,
                siegeData: enriched,
                defenderName: enriched.defenderName,
                countdownEndsAt: Date.now() + ws * 1000,
                waitSeconds: ws,
              });
              setPvpCountdown(ws);
              setSiegeResult(null);
            }
          } catch (e) {
            console.error('[PVP] 创建挑战失败:', e);
            setSiegeData(enriched); setSiegeResult(null);
          }
        } else {
          setSiegeData(enriched); setSiegeResult(null);
        }
      } else {
        setSimpleAlertMessage(
          typeof res.error === 'string' && res.error.trim()
            ? res.error
            : '攻城请求失败，请稍后重试',
        );
      }
    } catch (e) {
      setSimpleAlertMessage(e?.message || '网络异常，攻城请求失败');
    }
    setSiegeLoading(false);
  }, [phase, siegeData, banditRaidData, banditRaidResult, player, cards, attributeBonusBySlot]);

  const startPvpBaseCampSiege = useCallback(
    async (pvpWarId, warSlice) => {
      if (!pvpWarId || !player?.player_id) return;
      const targetCityId = warSlice?.targetCityId;
      if (!targetCityId) return;
      const phaseOk = phase === PHASE.IDLE || phase === PHASE.RETURNING;
      if (!phaseOk) {
        setSimpleAlertMessage('当前处于事件/探索流程中，请返回空闲后再发起');
        return;
      }
      if (siegeData) {
        setSimpleAlertMessage('已有战斗或结算占用，请先结束上一场或刷新页面后再试。');
        return;
      }
      if (banditRaidData) {
        setSimpleAlertMessage('匪寨战斗进行中，请先结束上一场后再试。');
        return;
      }
      if (banditRaidResult) {
        setSimpleAlertMessage('请先关闭匪寨结算面板后再试。');
        return;
      }
      const qRes = await fetchSiegeQuotaJson(player.player_id, targetCityId);
      if (!qRes.success || !(Number(qRes.data?.remaining) > 0)) {
        setSimpleAlertMessage('攻城次数不足');
        return;
      }
      const gate = validateMainLineupBattleGate({
        cards,
        playerUnits: null,
        playerFood: player?.food ?? 0,
      });
      if (!gate.ok) {
        setSimpleAlertMessage(gate.message);
        return;
      }
      setSiegeLoading(true);
      try {
        const sg = await warAPI.initiateBaseCampSiege(pvpWarId, player.player_id);
        if (!sg?.success || !sg.data) {
          setSimpleAlertMessage(sg?.error || '攻打大本营请求失败，请稍后重试');
          return;
        }
        const d = sg.data;
        const opp =
          (warSlice?.attackerFactionName && String(warSlice.attackerFactionName).trim()) ||
          '攻方';
        setSiegeData({
          pvpDefenderBaseCampSiege: true,
          pvpWarId: d.pvpWarId || pvpWarId,
          targetCityId: d.targetCityId || targetCityId,
          cityName: d.targetCityName || warSlice?.targetCityName || '目标城',
          defenderType: 'npc',
          npcGarrison: Array.isArray(d.baseCampSlice) ? d.baseCampSlice : [],
          npcBatchIndex: d.batchIndex ?? 0,
          npcAlive: d.baseCampAlive,
          npcTotal: d.baseCampTotal,
          isPvp: false,
          opponentName: `${opp}大本营守军`,
        });
        setSiegeResult(null);
      } catch (e) {
        setSimpleAlertMessage(e?.message || '网络异常，攻打大本营失败');
      } finally {
        setSiegeLoading(false);
      }
    },
    [phase, siegeData, banditRaidData, banditRaidResult, player, cards],
  );

  const handleBanditRaidStart = useCallback((payload) => {
    if (!player?.player_id) return;
    if (!payload?.banditPoiId || payload?.attackedLayer == null) return;
    if (!payload?.smallMapPveLoot || typeof payload.smallMapPveLoot !== 'object') return;
    if (!Array.isArray(payload.enemySlotRarities) || payload.enemySlotRarities.length !== 4) return;
    const layer = Number(payload.attackedLayer);
    setBanditRaidData({
      banditPoiId: String(payload.banditPoiId).trim(),
      attackedLayer: layer,
      enemySlotRarities: payload.enemySlotRarities,
      smallMapPveLoot: payload.smallMapPveLoot,
      opponentName: `匪寨 · 第 ${Number.isFinite(layer) ? layer : 1} 层`,
    });
  }, [player?.player_id]);

  const handleBanditRaidEnd = useCallback(
    (result, silverSpent, scoreResult, killedIndices, meta) => {
      const cur = banditRaidDataRef.current;
      const opponentName = cur?.opponentName || '匪寨';
      const rawLoot = cur?.smallMapPveLoot && typeof cur.smallMapPveLoot === 'object' ? cur.smallMapPveLoot : {};
      const lootRest = { ...rawLoot };
      delete lootRest.banditRaidSettlement;
      let silverReward = 0;
      let reputationReward = 0;
      let foodReward = 0;
      let banditBaseSilver = 0;
      let banditBaseFood = 0;
      let banditMilestone = null;
      if (result === 'victory') {
        silverReward = Math.max(0, Number(lootRest.silver) || 0);
        reputationReward = Math.max(0, Number(lootRest.reputation) || 0);
        foodReward = Math.max(0, Number(lootRest.food) || 0);
        banditBaseSilver = Math.max(0, Number(lootRest.baseSilver ?? lootRest.silver) || 0);
        banditBaseFood = Math.max(0, Number(lootRest.baseFood ?? lootRest.food) || 0);
        banditMilestone =
          lootRest.milestone && typeof lootRest.milestone === 'object' ? lootRest.milestone : null;
      }
      const tk =
        meta?.totalKills != null && Number.isFinite(Number(meta.totalKills))
          ? Math.max(0, Math.floor(Number(meta.totalKills)))
          : Array.isArray(killedIndices)
            ? killedIndices.length
            : 0;
      const killCount = tk;
      const sc = scoreResult && typeof scoreResult === 'object' ? scoreResult : null;
      const tacticalScoreText =
        sc && (sc.grade != null || sc.score != null)
          ? `战术评分：${sc.grade ?? '-'} · ${Number(sc.score) || 0} 分`
          : null;
      setBanditRaidData(null);
      setBanditRaidResult({
        result,
        banditPoiId: cur?.banditPoiId != null ? String(cur.banditPoiId).trim() : null,
        attackedLayer: cur?.attackedLayer != null ? Number(cur.attackedLayer) : null,
        silverSpent: Math.max(0, Number(silverSpent) || 0),
        scoreResult: sc,
        killedIndices: Array.isArray(killedIndices) ? killedIndices : [],
        meta: meta && typeof meta === 'object' ? meta : {},
        opponentName,
        silverReward,
        reputationReward,
        foodReward,
        banditBaseSilver,
        banditBaseFood,
        banditMilestone,
        killCount,
        tacticalScoreText,
        defeatHint:
          result !== 'victory'
            ? '本场已扣攻打次数，个人层与全服耐久不因失败前进。左侧「放弃」将本寨层进度重置为第 1 层（已扣次数不返还）；「确定」仅关闭。'
            : null,
      });
      setPostBanditRaidRefreshKey((k) => k + 1);
      setGarrisonStatsRefreshKey((k) => k + 1);
      refreshPlayer({ silent: true });
      bumpStrategicRoadPresenceRef.current?.();
    },
    [refreshPlayer],
  );

  const closeBanditRaidResult = useCallback(() => {
    setBanditRaidResult(null);
    setPostBanditRaidRefreshKey((k) => k + 1);
  }, []);

  /** 匪寨战败「放弃」：`reset_tower` 将本寨 `nextLayer` 置 1，不返还攻打次数 */
  const handleBanditRaidAbandon = useCallback(async () => {
    if (!banditRaidResult || banditRaidResult.result === 'victory') return;
    clearInflightBattleTroopSnapshot();
    const banditPoiId = banditRaidResult.banditPoiId;
    if (!banditPoiId || !player?.player_id) {
      closeBanditRaidResult();
      return;
    }
    try {
      const res = await playerAPI.updateBanditRaidQuota(player.player_id, banditPoiId, 'reset_tower');
      if (!res?.success) {
        setSimpleAlertMessage(
          typeof res?.error === 'string' && res.error.trim() ? res.error : '重置层数失败',
        );
        return;
      }
    } catch (e) {
      setSimpleAlertMessage(e?.message || '重置层数失败');
      return;
    }
    setBanditRaidResult(null);
    setPostBanditRaidRefreshKey((k) => k + 1);
    setGarrisonStatsRefreshKey((k) => k + 1);
    refreshPlayer({ silent: true });
    bumpStrategicRoadPresenceRef.current?.();
  }, [banditRaidResult, player?.player_id, closeBanditRaidResult, refreshPlayer]);

  /** 匪寨胜利结算「继续」：不调用 consume，直接进下一层（次数已在首层攻打时扣除） */
  const handleBanditRaidContinue = useCallback(async () => {
    if (!banditRaidResult || banditRaidResult.result !== 'victory') return;
    const banditPoiId = banditRaidResult.banditPoiId;
    if (!banditPoiId || !player?.player_id) return;
    setBanditRaidResult(null);
    try {
      const res = await playerAPI.getBanditRaidQuota(player.player_id, banditPoiId);
      if (!res?.success || !res.data) {
        setSimpleAlertMessage(typeof res?.error === 'string' && res.error.trim() ? res.error : '无法读取匪寨攻打进度');
        return;
      }
      const d = res.data;
      const wd = d.worldDurability;
      const worldDepleted =
        wd &&
        typeof wd === 'object' &&
        Number.isFinite(Number(wd.layersRemaining)) &&
        Number(wd.layersRemaining) <= 0;
      if (d.towerCompleted) {
        setSimpleAlertMessage('本寨个人塔已通关。');
        return;
      }
      if (worldDepleted) {
        setSimpleAlertMessage('本寨全服耐久已耗尽，无法继续攻打。');
        return;
      }
      if (!d.canBattle) {
        setSimpleAlertMessage('当前不可继续攻打（攻打次数或条件不足）。');
        return;
      }
      const attackedLayer = Number(d.nextLayer);
      if (!Number.isFinite(attackedLayer) || attackedLayer < 1) {
        setSimpleAlertMessage('层进度异常，请返回大地图重试。');
        return;
      }
      const gate = validateMainLineupBattleGate({
        cards,
        playerUnits: null,
        playerFood: player?.food ?? 0,
      });
      if (!gate.ok) {
        setSimpleAlertMessage(gate.message || '无法进入下一层');
        return;
      }
      const enemySlotRarities = banditNpcSlotRaritiesFromLayer(attackedLayer);
      const lootBase = buildBanditLayerSmallMapPveLoot(attackedLayer);
      setBanditRaidData({
        banditPoiId: String(banditPoiId).trim(),
        attackedLayer,
        enemySlotRarities,
        smallMapPveLoot: {
          ...lootBase,
          banditRaidSettlement: { banditPoiId: String(banditPoiId).trim(), attackedLayer },
        },
        opponentName: `匪寨 · 第 ${attackedLayer} 层`,
      });
      setPostBanditRaidRefreshKey((k) => k + 1);
    } catch (e) {
      setSimpleAlertMessage(e?.message || '网络异常');
    }
  }, [banditRaidResult, player?.player_id, player?.food, cards]);

  // 战斗结束
  const handleSiegeEnd = useCallback(async (result, silverSpent, scoreResult, killedIndices, meta) => {
    if (!siegeData) return;
    // 防守方本地进入战场：兵力结算仅以攻城方提交的 siege-result 为准，此处只关界面并刷新
    if (siegeData.skipSiegeResult) {
      setSiegeData(null);
      setSiegeResult(null);
      setGarrisonStatsRefreshKey((k) => k + 1);
      refreshPlayer({ silent: true });
      return;
    }

    if (siegeData.roadEncounterId) {
      try {
        const res = await playerAPI.submitRoadEncounterBattleResult(player.player_id, {
          encounterId: siegeData.roadEncounterId,
          factionId: siegeData.playerFaction,
          killedIndices: killedIndices || [],
          result: result === 'victory' ? 'win' : 'lose',
          silverSpent: silverSpent || 0,
          battleScore: Number(scoreResult?.score) || 0,
          battleReportSaved: meta?.battleReportSaved !== false,
          battleId: meta?.battleId || null,
          ...(Array.isArray(meta?.defenderLineupTroopUpdates) && meta.defenderLineupTroopUpdates.length
            ? { defenderLineupTroopUpdates: meta.defenderLineupTroopUpdates }
            : {}),
        });
        if (res.success) {
          setSiegeResult({
            ...res.data,
            chestRewards: Array.isArray(meta?.chestRewards) ? meta.chestRewards : [],
            battleReportFailed: meta?.battleReportSaved === false,
          });
        } else {
          setSiegeResult({ npcKilled: 0, killCount: 0, npcTotal: 0, silverReward: 0, error: res.error });
        }
      } catch (err) {
        console.error('[RoadEncounter] 结算请求失败:', err);
        setSiegeResult({ npcKilled: 0, killCount: 0, npcTotal: 0, silverReward: 0, error: '结算请求失败' });
      }
      setGarrisonStatsRefreshKey((k) => k + 1);
      refreshPlayer({ silent: true });
      return;
    }

    try {
      if (siegeData.pvpDefenderBaseCampSiege && siegeData.pvpWarId) {
        const res = await warAPI.recordBaseCampSiegeResult(siegeData.pvpWarId, {
          playerId: player.player_id,
          killedIndices: killedIndices || [],
          result: result === 'victory' ? 'win' : 'lose',
          silverSpent: silverSpent || 0,
          battleScore: Number(scoreResult?.score) || 0,
          battleReportSaved: meta?.battleReportSaved,
        });
        if (res.success) {
          const d = res.data && typeof res.data === 'object' ? res.data : {};
          setSiegeResult({
            ...d,
            killCount: d.killCount ?? 0,
            npcKilled: d.npcKilled ?? d.killCount ?? 0,
            npcTotal: d.npcTotal ?? siegeData.npcTotal ?? null,
            siegeCompleted: !!d.siegeCompleted,
            chestRewards: Array.isArray(meta?.chestRewards) ? meta.chestRewards : [],
            battleReportFailed: meta?.battleReportSaved === false,
          });
        } else {
          setSiegeResult({ npcKilled: 0, killCount: 0, npcTotal: 0, silverReward: 0, error: res.error });
        }
        setGarrisonStatsRefreshKey((k) => k + 1);
        refreshPlayer({ silent: true });
        return;
      }

      const isPvpWar = !!siegeData.pvpWarId;
      let res;
      if (isPvpWar) {
        res = await warAPI.recordAttackerCitySiegeResult(siegeData.pvpWarId, {
          playerId: player.player_id,
          defenderType: siegeData.defenderType || 'npc',
          defenderPlayerId: siegeData.defenderPlayerId || null,
          defenderGarrisonSlot: siegeData.defenderGarrisonSlot ?? null,
          garrisonUnits: (siegeData.defenderType === 'player_garrison' || siegeData.defenderType === 'pvp_online')
            ? siegeData.npcGarrison
            : null,
          killedIndices: killedIndices || [],
          result: result === 'victory' ? 'win' : 'lose',
          silverSpent: silverSpent || 0,
          battleScore: Number(scoreResult?.score) || 0,
          battleReportSaved: meta?.battleReportSaved !== false,
          npcBatchIndex: siegeData.defenderType === 'npc' ? siegeData.npcBatchIndex ?? null : null,
          ...(Array.isArray(meta?.defenderLineupTroopUpdates) && meta.defenderLineupTroopUpdates.length
            ? { defenderLineupTroopUpdates: meta.defenderLineupTroopUpdates }
            : {}),
        });
      } else {
        res = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/cities/siege-result`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            warId: siegeData.warId, playerId: player.player_id,
            factionId: siegeData.playerFaction,
            killedIndices: killedIndices || [],
            result: result === 'victory' ? 'win' : 'lose',
            silverSpent: silverSpent || 0,
            battleScore: Number(scoreResult?.score) || 0,
            battleReportSaved: meta?.battleReportSaved !== false,
            defenderType: siegeData.defenderType || 'npc',
            npcBatchIndex: siegeData.defenderType === 'npc' ? siegeData.npcBatchIndex ?? null : null,
          }),
        }).then(r => r.json());
      }
      if (res.success) {
        setSiegeResult({
          ...res.data,
          chestRewards: Array.isArray(meta?.chestRewards) ? meta.chestRewards : [],
          battleReportFailed: meta?.battleReportSaved === false,
        });
      } else {
        // 后端报错，仍然显示结算页（无奖励数据）
        setSiegeResult({ npcKilled: 0, npcTotal: 0, silverReward: 0, error: res.error });
      }
    } catch (err) {
      console.error('[Siege] 结算请求失败:', err);
      setSiegeResult({ npcKilled: 0, npcTotal: 0, silverReward: 0, error: '结算请求失败' });
    }
    setGarrisonStatsRefreshKey((k) => k + 1);
    refreshPlayer({ silent: true });
  }, [siegeData, player, refreshPlayer]);

  const closeSiegeResult = useCallback(() => { setSiegeData(null); setSiegeResult(null); }, []);

  // 加载玩家道具
  const [playerItems, setPlayerItems] = useState([]);
  const fetchItems = useCallback(() => {
    if (!player?.player_id) return;
    playerAPI.getItems(player.player_id)
      .then(res => {
        if (res.success) setPlayerItems(res.data.items || []);
      })
      .catch(() => {});
  }, [player?.player_id]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  /** 战略格 tooltip 荒郊/集市：`WorldMapCityInfoBlock` 内嵌 `ExploreLocationDockPanel`（与底栏无关） */
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
    [quota, eventsLoading, explorePoolAt, startExplore, playerItems, isTutorial, phase, citiesList, itemNameMap],
  );

  /** 探索「返回中」动画结束后再拉档，避免 RETURNING 阶段整图重绘把战略城池 tooltip 顶掉，玩家可留在荒郊/集市连点探索 */
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

  const strategicFullScreenOverlayOpen =
    showSanGongFu || !!showGarrison || !!showBarracksPost;

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
        playerId={player?.player_id}
        playerFactionId={player?.faction_id}
        siegeLoading={siegeLoading}
        onStartSiegeForCity={startSiegeForCity}
        onRoadEncounterBattle={(enc) => {
          if (enc?.encounterId) setRoadAttackerAlert(enc);
        }}
        garrisonStatsRefreshKey={garrisonStatsRefreshKey}
        playerOnDuty={!!player?.on_duty}
        playerOnDutyCityId={player?.on_duty_city_id ?? null}
        playerMainCityId={playerMainCityIdForUi}
        playerMainCityChangedAt={player?.main_city_changed_at ?? null}
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
            onClose={() => {
              setShowGarrison(false);
              bumpStrategicMapRuntimeCaches();
            }}
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
            onClose={() => {
              setShowBarracksPost(false);
              setBarracksPostCityId(null);
            }}
            onAfterSave={bumpStrategicMapRuntimeCaches}
          />
        </Suspense>
      ) : null}

      {showSanGongFu ? (
        <Suspense fallback={<ChunkLoadFallback label="三公府加载中…" />}>
          <SanGongFuPanel
            cityName={sanGongFuCityName || '城池'}
            onClose={() => setShowSanGongFu(false)}
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
