/**
 * 战略大地图 · 攻城 / 匪寨 / 道路权威战 状态机与 API 编排（原 WorldMap.jsx 业务块）。
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { PHASE } from '@/components/event/EventConstants';
import { playerAPI } from '@/services/playerApi';
import { fetchWithTimeout } from '@/services/httpClient';
import { fetchSiegeQuotaJson } from '@/hooks/useSiegeQuota';
import { warAPI } from '@/services/warApi';
import { API_CONFIG } from '@/constants';
import { validateMainLineupBattleGate } from '@/utils/mainLineupTroops';
import { BASE_CAMP_SIEGE_FOOD_COST_MULTIPLIER } from '@shared/utils/pvpBaseCampConstants';
import { clearInflightBattleTroopSnapshot } from '@/utils/inflightBattleTroopSnapshot';
import { buildBanditLayerSmallMapPveLoot } from '@shared/utils/banditRaidLayerRewards';
import { banditNpcSlotRaritiesFromLayer } from '@shared/utils/smallMapEnemyRoster';
import { worldMapCityIsPlayerSameFaction } from '@/utils/worldMapCityPanelCopy';
import { worldMapOverlayRefs } from '@/utils/worldMapOverlayRefs';

/** 与 backend `roadConfig.ROAD_DEFENDER_ALERT_SEC` 一致：攻方自动裁定等待窗 */
const ROAD_ENCOUNTER_AUTO_RESOLVE_SEC = 10;

/** 攻城 / 攻大本营（NPC 批次）· 结算双按钮与 BGM 适用范围（不含道路遭遇、玩家驻守） */
export function isWorldMapNpcSiegeBgmContext(siegeData) {
  if (!siegeData || siegeData.roadEncounterId) return false;
  if (siegeData.pvpDefenderBaseCampSiege) return true;
  const dt = siegeData.defenderType || 'npc';
  return dt === 'npc';
}

/** 胜利且仍有 NPC 守军 / 大本营未破时，结算可「继续」 */
export function canContinueWorldMapNpcSiege(siegeData, siegeResult) {
  if (!isWorldMapNpcSiegeBgmContext(siegeData) || !siegeResult) return false;
  if (siegeResult.siegeCompleted) return false;
  if (siegeResult.battleOutcome === 'defeat' || siegeResult.attackerWon === false) return false;
  const won =
    siegeResult.battleOutcome === 'victory' ||
    siegeResult.attackerWon === true ||
    (siegeResult.battleOutcome == null &&
      siegeResult.attackerWon == null &&
      (Number(siegeResult.killCount) > 0 || Number(siegeResult.personalSilverEarned) > 0));
  if (!won) return false;
  const npcTotal = Number(siegeResult.npcTotal ?? 0);
  const npcKilled = Number(siegeResult.npcKilled ?? siegeResult.killCount ?? 0);
  if (npcTotal > 0 && npcKilled >= npcTotal) return false;
  const npcAlive = siegeResult.npcAlive ?? siegeResult.baseCampAlive;
  if (npcAlive != null && Number(npcAlive) <= 0) return false;
  return true;
}

function buildSiegeResultFromAuthoritative(d) {
  const record = d?.record && typeof d.record === 'object' ? d.record : {};
  const attackerWon = !!d.attackerWon;
  return {
    ...record,
    attackerWon,
    battleOutcome: attackerWon ? 'victory' : 'defeat',
    killCount: d.killCount ?? record.killCount ?? 0,
    npcKilled: d.npcKilled ?? record.npcKilled ?? d.killCount ?? record.killCount ?? 0,
    npcTotal: d.npcTotal ?? record.npcTotal ?? null,
    npcAlive: d.npcAlive ?? record.npcAlive ?? d.baseCampAlive ?? record.baseCampAlive ?? null,
    baseCampAlive: d.baseCampAlive ?? record.baseCampAlive ?? null,
    baseCampTotal: d.baseCampTotal ?? record.baseCampTotal ?? null,
    siegeCompleted: !!(d.siegeCompleted ?? record.siegeCompleted),
    defenderType: d.defenderType || record.defenderType || 'npc',
    chestRewards: [],
  };
}

function buildSiegeContinueContextFromAuthoritative(d, pending) {
  const kind = pending?.kind;
  const cityId = d.cityId || pending?.cityId || null;
  return {
    autoBattleResolved: true,
    cityId,
    targetCityId: cityId,
    cityName: d.cityName || pending?.cityName || '城池',
    warId: d.warId || null,
    pvpWarId: d.pvpWarId || pending?.pvpWarId || null,
    playerFaction: d.playerFaction || pending?.playerFaction || null,
    defenderType: d.defenderType || 'npc',
    pvpDefenderBaseCampSiege: kind === 'baseCamp' || !!d.pvpDefenderBaseCampSiege,
    opponentName: pending?.opponentName || null,
    npcAlive: d.npcAlive ?? null,
    npcTotal: d.npcTotal ?? null,
  };
}

export function useWorldMapStrategicBattles({
  player,
  cards,
  phase,
  refreshPlayer,
  setSimpleAlertMessage,
  /** ref：{ setPvpChallenge, setPvpCountdown }，由 WorldMap 在 usePvpSiegeAdjudication 之后写入 */
  pvpActionsRef,
  /** ref：{ setAuthoritativeReplayOverlay }，同上 */
  authoritativeReplayRef,
  roadAttackerAlert,
  setRoadAttackerAlert,
  bumpStrategicRoadPresenceRef,
}) {
  const [siegeData, setSiegeData] = useState(null);
  const [siegeResult, setSiegeResult] = useState(null);
  const [siegeLoading, setSiegeLoading] = useState(false);
  const [garrisonStatsRefreshKey, setGarrisonStatsRefreshKey] = useState(0);
  const [banditRaidData, setBanditRaidData] = useState(null);
  const [banditRaidResult, setBanditRaidResult] = useState(null);
  const [postBanditRaidRefreshKey, setPostBanditRaidRefreshKey] = useState(0);
  const [roadAttackerAdjudicating, setRoadAttackerAdjudicating] = useState(null);
  const [roadAttackerCountdown, setRoadAttackerCountdown] = useState(0);
  /** @type {[{ kind:'pve'|'pvp'|'baseCamp', cityId?:string, pvpWarId?:string, cityName?:string, cityRow?:object, opponentName?:string, playerFaction?:string }|null, Function]} */
  const [pendingSiegeConfirm, setPendingSiegeConfirm] = useState(null);
  const [siegeAdjudicating, setSiegeAdjudicating] = useState(false);
  const [siegeChargeCinematic, setSiegeChargeCinematic] = useState(null);

  const banditRaidDataRef = useRef(null);
  const roadResolveOnceRef = useRef(false);
  const roadAutoTimerRef = useRef(null);
  const roadCountdownTimerRef = useRef(null);
  useEffect(() => {
    banditRaidDataRef.current = banditRaidData;
  }, [banditRaidData]);

  const bumpGarrisonStats = useCallback(() => {
    setGarrisonStatsRefreshKey((k) => k + 1);
  }, []);

  const banditRaidStartBlockedReason = useMemo(() => {
    const phaseOk = phase === PHASE.IDLE || phase === PHASE.RETURNING;
    if (!phaseOk) return '当前处于事件/探索流程中，请返回空闲后再攻打匪寨';
    if (siegeData) return '已有攻城或结算占用，请先结束上一场';
    if (pendingSiegeConfirm || siegeAdjudicating || siegeChargeCinematic) {
      return '攻城流程进行中，请稍候';
    }
    if (banditRaidData) return '匪寨战斗进行中';
    if (banditRaidResult) return '请先关闭上一场匪寨结算';
    return null;
  }, [
    phase,
    siegeData,
    pendingSiegeConfirm,
    siegeAdjudicating,
    siegeChargeCinematic,
    banditRaidData,
    banditRaidResult,
  ]);

  const runRoadEncounterAuthoritativeResolve = useCallback(
    async (encounterIdRaw) => {
      const eid = encounterIdRaw != null ? String(encounterIdRaw).trim() : '';
      if (!eid || !player?.playerId || roadResolveOnceRef.current) return;
      roadResolveOnceRef.current = true;
      if (roadAutoTimerRef.current) {
        clearTimeout(roadAutoTimerRef.current);
        roadAutoTimerRef.current = null;
      }
      if (roadCountdownTimerRef.current) {
        clearInterval(roadCountdownTimerRef.current);
        roadCountdownTimerRef.current = null;
      }
      setRoadAttackerCountdown(0);
      setRoadAttackerAlert(null);

      const gate = validateMainLineupBattleGate({
        cards,
        playerUnits: null,
        playerFood: player?.food ?? 0,
      });
      if (!gate.ok) {
        roadResolveOnceRef.current = false;
        setSimpleAlertMessage(gate.message);
        return;
      }

      setRoadAttackerAdjudicating({ encounterId: eid, startedAt: Date.now() });
      try {
        const res = await playerAPI.resolveRoadEncounterAuthoritative(player.playerId, eid);
        if (!res?.success || !res.data) {
          setRoadAttackerAdjudicating(null);
          setSimpleAlertMessage(res?.error || '道路权威结算失败');
          roadResolveOnceRef.current = false;
          return;
        }
        const d = res.data;
        const logStr = Array.isArray(d.battleLog) ? d.battleLog.join('\n') : '';
        const siegeResultSnapshot = {
          ...(d.settlement && typeof d.settlement === 'object' ? d.settlement : {}),
          attackerWon: d.attackerWon,
          authoritativeBattleLog: d.battleLog,
          battleSeed: d.battleSeed,
          siegeReplayAttackerNames: d.siegeReplayAttackerNames,
          siegeReplayDefenderNames: d.siegeReplayDefenderNames,
          initialAttackerTroops: d.initialAttackerTroops,
          initialDefenderTroops: d.initialDefenderTroops,
          ...(d.defeatRetreatNotice ? { defeatRetreatNotice: d.defeatRetreatNotice } : {}),
        };
        setRoadAttackerAdjudicating(null);
        authoritativeReplayRef?.current?.setAuthoritativeReplayOverlay?.({
          battleLogStr: logStr,
          eventReplayRoomId: d.eventReplay?.roomId || null,
          eventReplayTitle: '道路遭遇',
          initialAttackerTroops: d.initialAttackerTroops,
          initialDefenderTroops: d.initialDefenderTroops,
          leftLabel: '攻方',
          rightLabel: '守军',
          onPlaybackComplete: () => {
            authoritativeReplayRef?.current?.setAuthoritativeReplayOverlay?.(null);
            setSiegeResult(siegeResultSnapshot);
            bumpGarrisonStats();
            refreshPlayer({ silent: true });
            bumpStrategicRoadPresenceRef?.current?.();
          },
        });
      } catch (e) {
        setRoadAttackerAdjudicating(null);
        setSimpleAlertMessage(e?.message || '网络异常');
        roadResolveOnceRef.current = false;
      }
    },
    [
      player,
      cards,
      refreshPlayer,
      setSimpleAlertMessage,
      setRoadAttackerAlert,
      authoritativeReplayRef,
      bumpGarrisonStats,
      bumpStrategicRoadPresenceRef,
    ],
  );

  /** 攻方：遇袭弹窗倒计时结束后自动权威裁定（与攻城 PVP 对齐，避免未点确定而永久 fighting） */
  useEffect(() => {
    const eid = roadAttackerAlert?.encounterId;
    if (!eid || !player?.playerId) {
      roadResolveOnceRef.current = false;
      setRoadAttackerCountdown(0);
      return undefined;
    }
    roadResolveOnceRef.current = false;
    const endsAt = Date.now() + ROAD_ENCOUNTER_AUTO_RESOLVE_SEC * 1000;
    setRoadAttackerCountdown(ROAD_ENCOUNTER_AUTO_RESOLVE_SEC);
    roadCountdownTimerRef.current = setInterval(() => {
      setRoadAttackerCountdown(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 250);
    roadAutoTimerRef.current = setTimeout(
      () => runRoadEncounterAuthoritativeResolve(eid),
      ROAD_ENCOUNTER_AUTO_RESOLVE_SEC * 1000,
    );
    const onVis = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      if (Date.now() < endsAt) return;
      if (roadAutoTimerRef.current) clearTimeout(roadAutoTimerRef.current);
      runRoadEncounterAuthoritativeResolve(eid);
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => {
      if (roadAutoTimerRef.current) clearTimeout(roadAutoTimerRef.current);
      if (roadCountdownTimerRef.current) clearInterval(roadCountdownTimerRef.current);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    };
  }, [roadAttackerAlert?.encounterId, player?.playerId, runRoadEncounterAuthoritativeResolve]);

  const confirmRoadAttackerEnterBattle = useCallback(() => {
    if (!roadAttackerAlert?.encounterId) return;
    runRoadEncounterAuthoritativeResolve(roadAttackerAlert.encounterId);
  }, [roadAttackerAlert?.encounterId, runRoadEncounterAuthoritativeResolve]);

  const cancelPendingSiegeConfirm = useCallback(() => {
    setPendingSiegeConfirm(null);
  }, []);

  const runSiegeAuthoritativeFlow = useCallback(
    async (pending) => {
      if (!pending || !player?.playerId) return;
      setPendingSiegeConfirm(null);
      setSiegeAdjudicating(true);
      setSiegeLoading(true);
      try {
        let res;
        if (pending.kind === 'pvp') {
          res = await warAPI.resolveAttackerCitySiegeAuthoritative(
            pending.pvpWarId,
            player.playerId,
          );
        } else if (pending.kind === 'baseCamp') {
          res = await warAPI.resolveBaseCampSiegeAuthoritative(
            pending.pvpWarId,
            player.playerId,
          );
        } else {
          res = await fetchWithTimeout(
            `${API_CONFIG.BASE_URL}/cities/${encodeURIComponent(pending.cityId)}/siege-authoritative-resolve`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerId: player.playerId }),
            },
          ).then((r) => r.json());
        }

        if (!res?.success || !res.data?.ok) {
          setSimpleAlertMessage(
            (typeof res?.error === 'string' && res.error.trim()) ||
              res?.data?.reason ||
              res?.data?.error ||
              '自动战斗失败，请稍后重试',
          );
          return;
        }

        const d = res.data;
        const title =
          pending.kind === 'baseCamp'
            ? `${d.cityName || pending.cityName || '目标城'} · 大本营`
            : `${d.cityName || pending.cityName || '城池'} · 攻城`;

        setSiegeChargeCinematic({
          title,
          leftLabel: pending.kind === 'baseCamp' ? '守方' : '攻方',
          rightLabel: pending.kind === 'baseCamp' ? '大本营' : '守军',
          attackerWon: !!d.attackerWon,
          initialAttackerTroops: d.initialAttackerTroops || [],
          initialDefenderTroops: d.initialDefenderTroops || [],
          attackerTroopsEnd: d.attackerTroopsEnd || [],
          defenderTroopsEnd: d.defenderTroopsEnd || [],
          pending,
          payload: d,
        });
      } catch (e) {
        setSimpleAlertMessage(e?.message || '网络异常，自动战斗失败');
      } finally {
        setSiegeAdjudicating(false);
        setSiegeLoading(false);
      }
    },
    [player, setSimpleAlertMessage],
  );

  const confirmPendingSiegeEnterBattle = useCallback(() => {
    if (!pendingSiegeConfirm) return;
    void runSiegeAuthoritativeFlow(pendingSiegeConfirm);
  }, [pendingSiegeConfirm, runSiegeAuthoritativeFlow]);

  const siegeChargeCinematicRef = useRef(null);
  useEffect(() => {
    siegeChargeCinematicRef.current = siegeChargeCinematic;
  }, [siegeChargeCinematic]);

  const finishSiegeChargeCinematic = useCallback(() => {
    const cur = siegeChargeCinematicRef.current;
    if (!cur?.payload) {
      setSiegeChargeCinematic(null);
      return;
    }
    const d = cur.payload;
    const ctx = buildSiegeContinueContextFromAuthoritative(d, cur.pending);
    setSiegeChargeCinematic(null);
    setSiegeData(ctx);
    setSiegeResult(buildSiegeResultFromAuthoritative(d));
    bumpGarrisonStats();
    refreshPlayer({ silent: true });
    bumpStrategicRoadPresenceRef?.current?.();
  }, [bumpGarrisonStats, refreshPlayer, bumpStrategicRoadPresenceRef]);

  const startSiegeForCity = useCallback(async (cityId, cityRow) => {
    if (!cityId || !player?.playerId) return;
    const phaseOk = phase === PHASE.IDLE || phase === PHASE.RETURNING;
    if (!phaseOk) {
      setSimpleAlertMessage('当前处于事件/探索流程中，请返回空闲后再发起攻城');
      return;
    }
    if (siegeData || siegeResult) {
      setSimpleAlertMessage('已有战斗或结算占用，请先结束上一场或刷新页面后再试。');
      return;
    }
    if (pendingSiegeConfirm || siegeAdjudicating || siegeChargeCinematic) {
      setSimpleAlertMessage('攻城流程进行中，请稍候。');
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
    if (worldMapCityIsPlayerSameFaction(cityRow, player?.factionId)) return;

    const qRes = await fetchSiegeQuotaJson(player.playerId, cityId);
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

    const targetIsOccupied = !!(cityRow && cityRow.faction_id);
    const cityName = cityRow?.city_name || cityRow?.cityName || '城池';

    if (targetIsOccupied) {
      setSiegeLoading(true);
      try {
        const activeRes = await warAPI.getActiveByCity(cityId);
        const pvpWar = activeRes?.success ? activeRes.data : null;
        if (!pvpWar || pvpWar.status !== 'active') {
          setSimpleAlertMessage(
            '该城已被势力占领，需先由君主宣战、放置攻方大本营进入战事才能发起攻城',
          );
          return;
        }
        setPendingSiegeConfirm({
          kind: 'pvp',
          cityId,
          pvpWarId: pvpWar.pvpWarId,
          cityName,
          playerFaction: player.factionId,
        });
      } catch (e) {
        setSimpleAlertMessage(e?.message || '网络异常，攻城请求失败');
      } finally {
        setSiegeLoading(false);
      }
      return;
    }

    setPendingSiegeConfirm({
      kind: 'pve',
      cityId,
      cityName,
      playerFaction: player.factionId,
    });
  }, [
    phase,
    siegeData,
    siegeResult,
    pendingSiegeConfirm,
    siegeAdjudicating,
    siegeChargeCinematic,
    banditRaidData,
    banditRaidResult,
    player,
    cards,
    setSimpleAlertMessage,
  ]);

  const startPvpBaseCampSiege = useCallback(
    async (pvpWarId, warSlice) => {
      if (!pvpWarId || !player?.playerId) return;
      const targetCityId = warSlice?.targetCityId;
      if (!targetCityId) return;
      const phaseOk = phase === PHASE.IDLE || phase === PHASE.RETURNING;
      if (!phaseOk) {
        setSimpleAlertMessage('当前处于事件/探索流程中，请返回空闲后再发起');
        return;
      }
      if (siegeData || siegeResult) {
        setSimpleAlertMessage('已有战斗或结算占用，请先结束上一场或刷新页面后再试。');
        return;
      }
      if (pendingSiegeConfirm || siegeAdjudicating || siegeChargeCinematic) {
        setSimpleAlertMessage('攻城流程进行中，请稍候。');
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
      const qRes = await fetchSiegeQuotaJson(player.playerId, targetCityId);
      if (!qRes.success || !(Number(qRes.data?.remaining) > 0)) {
        setSimpleAlertMessage('攻城次数不足');
        return;
      }
      const gate = validateMainLineupBattleGate({
        cards,
        playerUnits: null,
        playerFood: player?.food ?? 0,
        foodCostMultiplier: BASE_CAMP_SIEGE_FOOD_COST_MULTIPLIER,
      });
      if (!gate.ok) {
        setSimpleAlertMessage(gate.message);
        return;
      }
      const opp =
        (warSlice?.attackerFactionName && String(warSlice.attackerFactionName).trim()) || '攻方';
      setPendingSiegeConfirm({
        kind: 'baseCamp',
        cityId: targetCityId,
        pvpWarId,
        cityName: warSlice?.targetCityName || '目标城',
        opponentName: `${opp}大本营守军`,
        playerFaction: player.factionId,
      });
    },
    [
      phase,
      siegeData,
      siegeResult,
      pendingSiegeConfirm,
      siegeAdjudicating,
      siegeChargeCinematic,
      banditRaidData,
      banditRaidResult,
      player,
      cards,
      setSimpleAlertMessage,
    ],
  );

  const handleBanditRaidStart = useCallback((payload) => {
    if (!player?.playerId) return;
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
  }, [player?.playerId]);

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
      bumpGarrisonStats();
      refreshPlayer({ silent: true });
      bumpStrategicRoadPresenceRef?.current?.();
    },
    [refreshPlayer, bumpGarrisonStats, bumpStrategicRoadPresenceRef],
  );

  const closeBanditRaidResult = useCallback(() => {
    setBanditRaidResult(null);
    setPostBanditRaidRefreshKey((k) => k + 1);
  }, []);

  const handleBanditRaidAbandon = useCallback(async () => {
    if (!banditRaidResult || banditRaidResult.result === 'victory') return;
    clearInflightBattleTroopSnapshot();
    const banditPoiId = banditRaidResult.banditPoiId;
    if (!banditPoiId || !player?.playerId) {
      closeBanditRaidResult();
      return;
    }
    try {
      const res = await playerAPI.updateBanditRaidQuota(player.playerId, banditPoiId, 'reset_tower');
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
    bumpGarrisonStats();
    refreshPlayer({ silent: true });
    bumpStrategicRoadPresenceRef?.current?.();
  }, [
    banditRaidResult,
    player?.playerId,
    closeBanditRaidResult,
    refreshPlayer,
    setSimpleAlertMessage,
    bumpGarrisonStats,
    bumpStrategicRoadPresenceRef,
  ]);

  const handleBanditRaidContinue = useCallback(async () => {
    if (!banditRaidResult || banditRaidResult.result !== 'victory') return;
    const banditPoiId = banditRaidResult.banditPoiId;
    if (!banditPoiId || !player?.playerId) return;
    try {
      const res = await playerAPI.getBanditRaidQuota(player.playerId, banditPoiId);
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
      setBanditRaidResult(null);
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
  }, [banditRaidResult, player?.playerId, player?.food, cards, setSimpleAlertMessage]);

  const handleSiegeEnd = useCallback(async (result, silverSpent, scoreResult, killedIndices, meta) => {
    if (!siegeData) return;
    if (siegeData.skipSiegeResult) {
      setSiegeData(null);
      setSiegeResult(null);
      bumpGarrisonStats();
      refreshPlayer({ silent: true });
      return;
    }

    if (siegeData.roadEncounterId) {
      try {
        const res = await playerAPI.submitRoadEncounterBattleResult(player.playerId, {
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
            battleOutcome: result,
            chestRewards: Array.isArray(meta?.chestRewards) ? meta.chestRewards : [],
            battleReportFailed: meta?.battleReportSaved === false,
          });
        } else {
          setSiegeResult({ npcKilled: 0, killCount: 0, npcTotal: 0, silverReward: 0, battleOutcome: result, error: res.error });
        }
      } catch (err) {
        console.error('[RoadEncounter] 结算请求失败:', err);
        setSiegeResult({ npcKilled: 0, killCount: 0, npcTotal: 0, silverReward: 0, battleOutcome: result, error: '结算请求失败' });
      }
      bumpGarrisonStats();
      refreshPlayer({ silent: true });
      return;
    }

    try {
      if (siegeData.pvpDefenderBaseCampSiege && siegeData.pvpWarId) {
        const res = await warAPI.recordBaseCampSiegeResult(siegeData.pvpWarId, {
          playerId: player.playerId,
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
            battleOutcome: result,
            killCount: d.killCount ?? 0,
            npcKilled: d.npcKilled ?? d.killCount ?? 0,
            npcTotal: d.npcTotal ?? siegeData.npcTotal ?? null,
            siegeCompleted: !!d.siegeCompleted,
            chestRewards: Array.isArray(meta?.chestRewards) ? meta.chestRewards : [],
            battleReportFailed: meta?.battleReportSaved === false,
          });
        } else {
          setSiegeResult({ npcKilled: 0, killCount: 0, npcTotal: 0, silverReward: 0, battleOutcome: result, error: res.error });
        }
        bumpGarrisonStats();
        refreshPlayer({ silent: true });
        return;
      }

      const isPvpWar = !!siegeData.pvpWarId;
      let res;
      if (isPvpWar) {
        res = await warAPI.recordAttackerCitySiegeResult(siegeData.pvpWarId, {
          playerId: player.playerId,
          defenderType: siegeData.defenderType || 'npc',
          defenderPlayerId: siegeData.defenderPlayerId || null,
          defenderGarrisonSlot: siegeData.defenderGarrisonSlot ?? null,
          garrisonUnits: siegeData.defenderType === 'player_garrison'
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
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            warId: siegeData.warId,
            playerId: player.playerId,
            factionId: siegeData.playerFaction,
            killedIndices: killedIndices || [],
            result: result === 'victory' ? 'win' : 'lose',
            silverSpent: silverSpent || 0,
            battleScore: Number(scoreResult?.score) || 0,
            battleReportSaved: meta?.battleReportSaved !== false,
            defenderType: siegeData.defenderType || 'npc',
            npcBatchIndex: siegeData.defenderType === 'npc' ? siegeData.npcBatchIndex ?? null : null,
          }),
        }).then((r) => r.json());
      }
      if (res.success) {
        setSiegeResult({
          ...res.data,
          battleOutcome: result,
          chestRewards: Array.isArray(meta?.chestRewards) ? meta.chestRewards : [],
          battleReportFailed: meta?.battleReportSaved === false,
        });
      } else {
        setSiegeResult({ npcKilled: 0, npcTotal: 0, silverReward: 0, battleOutcome: result, error: res.error });
      }
    } catch (err) {
      console.error('[Siege] 结算请求失败:', err);
      setSiegeResult({ npcKilled: 0, npcTotal: 0, silverReward: 0, battleOutcome: result, error: '结算请求失败' });
    }
    bumpGarrisonStats();
    refreshPlayer({ silent: true });
  }, [siegeData, player, refreshPlayer, bumpGarrisonStats]);

  const closeSiegeResult = useCallback(() => {
    const notice =
      typeof siegeResult?.defeatRetreatNotice === 'string' ? siegeResult.defeatRetreatNotice.trim() : '';
    setSiegeData(null);
    setSiegeResult(null);
    if (notice) worldMapOverlayRefs.enqueueRoadGateNotice?.(notice);
  }, [siegeResult]);

  const applySiegeInitiatePayload = useCallback(
    async (enriched, { cityId, pvpWarIdForResult = null, baseCampWarSlice = null } = {}) => {
      if (!enriched || typeof enriched !== 'object') {
        setSimpleAlertMessage('攻城请求失败，请稍后重试');
        return false;
      }
      if (enriched.defenderType === 'pvp_online') {
        setSimpleAlertMessage('披挂上阵已移除，无法发起该类型对战');
        return false;
      }
      if (enriched.pvpDefenderBaseCampSiege || baseCampWarSlice || enriched.baseCampSlice) {
        const warSlice = baseCampWarSlice || {};
        const opp =
          (warSlice.attackerFactionName && String(warSlice.attackerFactionName).trim()) || '攻方';
        setSiegeData({
          pvpDefenderBaseCampSiege: true,
          pvpWarId: enriched.pvpWarId || pvpWarIdForResult,
          targetCityId: enriched.targetCityId || cityId,
          cityName: enriched.targetCityName || enriched.cityName || warSlice.targetCityName || '目标城',
          defenderType: 'npc',
          npcGarrison: Array.isArray(enriched.baseCampSlice)
            ? enriched.baseCampSlice
            : enriched.npcGarrison || [],
          npcBatchIndex: enriched.batchIndex ?? enriched.npcBatchIndex ?? 0,
          npcAlive: enriched.baseCampAlive ?? enriched.npcAlive,
          npcTotal: enriched.baseCampTotal ?? enriched.npcTotal,
          isPvp: false,
          opponentName: warSlice.opponentName || `${opp}大本营守军`,
        });
      } else {
        const payload = pvpWarIdForResult ? { ...enriched, pvpWarId: pvpWarIdForResult } : enriched;
        setSiegeData(payload);
      }
      setSiegeResult(null);
      return true;
    },
    [player, setSimpleAlertMessage, pvpActionsRef],
  );

  const handleSiegeContinue = useCallback(async () => {
    if (!canContinueWorldMapNpcSiege(siegeData, siegeResult)) return;
    const cityId = siegeData.targetCityId || siegeData.cityId;
    if (!cityId || !player?.playerId) return;

    const gate = validateMainLineupBattleGate({
      cards,
      playerUnits: null,
      playerFood: player?.food ?? 0,
      foodCostMultiplier: siegeData.pvpDefenderBaseCampSiege ? BASE_CAMP_SIEGE_FOOD_COST_MULTIPLIER : 1,
    });
    if (!gate.ok) {
      setSimpleAlertMessage(gate.message || '无法继续攻城');
      return;
    }

    const qRes = await fetchSiegeQuotaJson(player.playerId, cityId);
    if (!qRes.success || !(Number(qRes.data?.remaining) > 0)) {
      setSimpleAlertMessage('攻城次数不足');
      return;
    }

    // 继续下一场：再确认一次 → 权威演算（不进棋盘）
    setSiegeResult(null);
    setSiegeData(null);
    if (siegeData.pvpDefenderBaseCampSiege && siegeData.pvpWarId) {
      setPendingSiegeConfirm({
        kind: 'baseCamp',
        cityId,
        pvpWarId: siegeData.pvpWarId,
        cityName: siegeData.cityName || '目标城',
        opponentName: siegeData.opponentName || '攻方大本营守军',
        playerFaction: player.factionId,
      });
      return;
    }
    if (siegeData.pvpWarId) {
      setPendingSiegeConfirm({
        kind: 'pvp',
        cityId,
        pvpWarId: siegeData.pvpWarId,
        cityName: siegeData.cityName || '城池',
        playerFaction: player.factionId || siegeData.playerFaction,
      });
      return;
    }
    setPendingSiegeConfirm({
      kind: 'pve',
      cityId,
      cityName: siegeData.cityName || '城池',
      playerFaction: player.factionId || siegeData.playerFaction,
    });
  }, [
    siegeData,
    siegeResult,
    player,
    cards,
    setSimpleAlertMessage,
  ]);

  return {
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
    roadAttackerAdjudicating,
    roadAttackerCountdown,
    pendingSiegeConfirm,
    siegeAdjudicating,
    siegeChargeCinematic,
    confirmPendingSiegeEnterBattle,
    cancelPendingSiegeConfirm,
    finishSiegeChargeCinematic,
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
  };
}

export default useWorldMapStrategicBattles;
