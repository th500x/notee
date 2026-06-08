/**
 * 战略大地图 · 攻城 / 匪寨 / 道路权威战 状态机与 API 编排（原 WorldMap.jsx 业务块）。
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { PHASE } from '@/components/event/EventConstants';
import { playerAPI } from '@/services/playerApi';
import { fetchWithTimeout } from '@/services/httpClient';
import { fetchSiegeQuotaJson, postSiegeQuotaAction } from '@/hooks/useSiegeQuota';
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
    if (banditRaidData) return '匪寨战斗进行中';
    if (banditRaidResult) return '请先关闭上一场匪寨结算';
    return null;
  }, [phase, siegeData, banditRaidData, banditRaidResult]);

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

  const startSiegeForCity = useCallback(async (cityId, cityRow) => {
    if (!cityId || !player?.playerId) return;
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
    setSiegeLoading(true);
    try {
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
        const sg = await warAPI.initiateAttackerCitySiege(pvpWar.pvpWarId, player.playerId);
        if (!sg?.success) {
          setSiegeLoading(false);
          setSimpleAlertMessage(sg?.error || '攻城请求失败，请稍后重试');
          return;
        }
        res = { success: true, data: { ...sg.data, playerFaction: player.factionId } };
        pvpWarIdForResult = pvpWar.pvpWarId;
      } else {
        res = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/cities/${encodeURIComponent(cityId)}/siege`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: player.playerId }),
        }).then((r) => r.json());
      }

      if (res.success) {
        await postSiegeQuotaAction(player.playerId, cityId, 'consume');
        const enriched = pvpWarIdForResult
          ? { ...res.data, pvpWarId: pvpWarIdForResult }
          : res.data;

        if (enriched.defenderType === 'pvp_online') {
          try {
            const pvpRes = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/pvp/challenge`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                warId: enriched.warId || null,
                pvpWarId: enriched.pvpWarId || null,
                cityId,
                attackerId: player.playerId,
                attackerFaction: enriched.playerFaction || player.factionId,
                defenderId: enriched.defenderPlayerId,
                defenderGarrisonSlot: enriched.defenderGarrisonSlot,
              }),
            }).then((r) => r.json());
            if (pvpRes.success) {
              const ws = Number(pvpRes.waitSeconds) || 10;
              pvpActionsRef?.current?.setPvpChallenge?.({
                ...pvpRes,
                siegeData: enriched,
                defenderName: enriched.defenderName,
                countdownEndsAt: Date.now() + ws * 1000,
                waitSeconds: ws,
              });
              pvpActionsRef?.current?.setPvpCountdown?.(ws);
              setSiegeResult(null);
            }
          } catch (e) {
            console.error('[PVP] 创建挑战失败:', e);
            setSiegeData(enriched);
            setSiegeResult(null);
          }
        } else {
          setSiegeData(enriched);
          setSiegeResult(null);
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
  }, [
    phase,
    siegeData,
    banditRaidData,
    banditRaidResult,
    player,
    cards,
    setSimpleAlertMessage,
    pvpActionsRef,
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
      setSiegeLoading(true);
      try {
        const sg = await warAPI.initiateBaseCampSiege(pvpWarId, player.playerId);
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
        refreshPlayer({ silent: true });
      } catch (e) {
        setSimpleAlertMessage(e?.message || '网络异常，攻打大本营失败');
      } finally {
        setSiegeLoading(false);
      }
    },
    [phase, siegeData, banditRaidData, banditRaidResult, player, cards, setSimpleAlertMessage, refreshPlayer],
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
    setBanditRaidResult(null);
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
          chestRewards: Array.isArray(meta?.chestRewards) ? meta.chestRewards : [],
          battleReportFailed: meta?.battleReportSaved === false,
        });
      } else {
        setSiegeResult({ npcKilled: 0, npcTotal: 0, silverReward: 0, error: res.error });
      }
    } catch (err) {
      console.error('[Siege] 结算请求失败:', err);
      setSiegeResult({ npcKilled: 0, npcTotal: 0, silverReward: 0, error: '结算请求失败' });
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
    startSiegeForCity,
    startPvpBaseCampSiege,
    handleBanditRaidStart,
    handleBanditRaidEnd,
    closeBanditRaidResult,
    handleBanditRaidAbandon,
    handleBanditRaidContinue,
    handleSiegeEnd,
    closeSiegeResult,
  };
}

export default useWorldMapStrategicBattles;
