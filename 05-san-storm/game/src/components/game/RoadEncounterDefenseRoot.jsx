import { useState, useRef, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { playerAPI } from '@/services/playerApi';
import AncientModal from '@/components/common/AncientModal';
import SiegeReplayMini from '@/components/game/SiegeReplayMini';
import PvpDefenseOutcomeModal from '@/components/game/PvpDefenseOutcomeModal';
import { RoadDefenseFrictionContext } from '@/contexts/RoadDefenseFrictionContext';
import {
  worldMapOverlayRefs,
  subscribeWorldMapOverlayGate,
  getWorldMapOverlayGateEpoch,
} from '@/utils/worldMapOverlayRefs';

/** 与 `WorldMap` 攻方权威推演、`PvpDefenseOutcomeModal` 内回放按钮同一套战报可播性启发式 */
function isRoadAuthoritativeBattleLogReplayable(battleLog) {
  const logStr = Array.isArray(battleLog)
    ? battleLog.join('\n')
    : typeof battleLog === 'string'
      ? battleLog
      : '';
  return (
    logStr.length > 12 &&
    /═══\s*第\s*\d+\s*回合\s*═══/.test(logStr) &&
    /次攻击/.test(logStr) &&
    /\[攻方\]/.test(logStr)
  );
}

/**
 * 道路守方遇袭 + 权威裁定 UI：挂在 GamePage 常驻，避免离开大地图 Tab 时 WorldMap 卸载导致守方收不到轮询。
 * 与攻城遇袭、道路战场互斥：读 `worldMapOverlayRefs`（由 WorldMap 同步）。
 */
export default function RoadEncounterDefenseRoot({ children, onBusyChange }) {
  const { player, refresh: refreshPlayer } = usePlayerContext();

  const [roadDefenseAlert, setRoadDefenseAlert] = useState(null);
  const [roadAwaitingAuthoritativeOutcome, setRoadAwaitingAuthoritativeOutcome] = useState(null);
  const [roadAuthoritativeOutcomeModal, setRoadAuthoritativeOutcomeModal] = useState(null);
  /** 守方裁定后与攻方对称：先全屏 `SiegeReplayMini`，结束再开评分/胜负弹窗 */
  const [defenderAuthoritativeReplayOverlay, setDefenderAuthoritativeReplayOverlay] = useState(null);
  const silencedRoadEncounterIdRef = useRef(null);
  const roadDefenseOutcomeReplayBlockingRef = useRef(false);
  const roadDefPollRef = useRef(null);
  const roadDefenseNotifiedEncounterIdRef = useRef(null);
  const pollRoadPendingRef = useRef(null);
  const refreshPlayerRef = useRef(refreshPlayer);
  refreshPlayerRef.current = refreshPlayer;
  const roadDefenseAlertRef = useRef(null);
  roadDefenseAlertRef.current = roadDefenseAlert;
  const roadAwaitingRef = useRef(null);
  roadAwaitingRef.current = roadAwaitingAuthoritativeOutcome;
  const roadOutcomeModalRef = useRef(null);
  roadOutcomeModalRef.current = roadAuthoritativeOutcomeModal;
  const defenderReplayRef = useRef(null);
  defenderReplayRef.current = defenderAuthoritativeReplayOverlay;
  /** 回放结束取结算载荷：勿依赖闭包里的 overlay，避免 refresh 重渲染后 payload 丢失 */
  const defenderReplayOutcomePayloadRef = useRef(null);
  defenderReplayOutcomePayloadRef.current = defenderAuthoritativeReplayOverlay?.outcomeForModal ?? null;

  const beginRoadDefenseSilence = useCallback((alert) => {
    if (!alert?.encounterId) return;
    silencedRoadEncounterIdRef.current = alert.encounterId;
    roadAwaitingRef.current = { encounterId: alert.encounterId };
    setRoadDefenseAlert(null);
    roadDefenseAlertRef.current = null;
    setRoadAwaitingAuthoritativeOutcome({ encounterId: alert.encounterId });
  }, []);

  const bumpCachesAfterRoadOutcome = useCallback(() => {
    silencedRoadEncounterIdRef.current = null;
    refreshPlayerRef.current?.({ silent: true });
  }, []);

  const pollRoadPending = useCallback(async () => {
    const pid = player?.player_id;
    if (!pid) return;
    try {
      const res = await playerAPI.getRoadPendingEncounter(pid);
      const enc = res?.success && res.data?.encounter ? res.data.encounter : null;
      if (!enc) {
        const alertSnap = roadDefenseAlertRef.current;
        const awaiting = !!roadAwaitingRef.current;
        const replay = !!defenderReplayRef.current;
        const modal = !!roadOutcomeModalRef.current;
        const hasPostBattleFlow = awaiting || replay || modal;
        // 战后仍停在遇袭弹窗：自动进入裁定查询，避免攻方先点确定后守方只剩空白
        if (alertSnap?.encounterId && !hasPostBattleFlow) {
          silencedRoadEncounterIdRef.current = alertSnap.encounterId;
          roadAwaitingRef.current = { encounterId: alertSnap.encounterId };
          setRoadAwaitingAuthoritativeOutcome({ encounterId: alertSnap.encounterId });
        } else if (!hasPostBattleFlow) {
          silencedRoadEncounterIdRef.current = null;
          roadDefenseNotifiedEncounterIdRef.current = null;
        }
        setRoadDefenseAlert(null);
        roadDefenseAlertRef.current = null;
        return;
      }
      if (worldMapOverlayRefs.pvpDefenseAlertActive) {
        setRoadDefenseAlert(null);
        return;
      }
      const sid = worldMapOverlayRefs.siegeRoadEncounterId;
      if (sid != null && String(sid) === String(enc.encounterId)) {
        setRoadDefenseAlert(null);
        return;
      }
      if (silencedRoadEncounterIdRef.current === enc.encounterId) {
        setRoadDefenseAlert(null);
        return;
      }
      setRoadDefenseAlert((prev) => {
        if (prev && String(prev.encounterId) === String(enc.encounterId)) {
          return { ...prev, ...enc };
        }
        return enc;
      });
      if (roadDefenseNotifiedEncounterIdRef.current !== enc.encounterId) {
        roadDefenseNotifiedEncounterIdRef.current = enc.encounterId;
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('🛤️ 道路遇袭', {
            body: `${enc.attackerName || '敌方'} 在道路上发起对战，可点确定进场观战`,
            tag: 'road-pvp',
          });
        } else if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      }
    } catch {
      /* 静默 */
    }
  }, [player?.player_id]);

  pollRoadPendingRef.current = pollRoadPending;

  /** 仅依赖 player_id：互斥状态在 poll 内读 refs，避免与 WorldMap 不同步 */
  useEffect(() => {
    if (!player?.player_id) return undefined;
    const run = () => {
      pollRoadPendingRef.current?.();
    };
    run();
    roadDefPollRef.current = setInterval(run, 3000);
    return () => {
      if (roadDefPollRef.current) clearInterval(roadDefPollRef.current);
    };
  }, [player?.player_id]);

  useEffect(() => {
    const onVis = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      pollRoadPendingRef.current?.();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const eid = roadDefenseAlert?.encounterId;
    if (!eid || roadDefenseAlert?.waitSeconds == null) return undefined;
    const rem = Math.min(120, Math.max(0, Number(roadDefenseAlert.remainingSeconds)));
    const snap = { ...roadDefenseAlert };
    const ms = rem <= 0 ? 0 : rem * 1000;
    const t = setTimeout(() => beginRoadDefenseSilence(snap), ms);
    return () => clearTimeout(t);
  }, [
    roadDefenseAlert?.encounterId,
    roadDefenseAlert?.remainingSeconds,
    roadDefenseAlert?.waitSeconds,
    beginRoadDefenseSilence,
  ]);

  useEffect(() => {
    const eid = roadAwaitingAuthoritativeOutcome?.encounterId;
    const pid = player?.player_id;
    if (!eid || !pid) return undefined;
    let cancelled = false;
    /** 避免裁定已返回后 interval 再次 tick 重复 setState，打断 SiegeReplayMini 自动播放 */
    let outcomeHandled = false;
    const tick = async () => {
      if (cancelled || outcomeHandled) return;
      try {
        const r = await playerAPI.getRoadEncounterAuthoritativeOutcome(pid, eid);
        if (cancelled || outcomeHandled || !r?.success || !r.data) return;
        if (r.data.pending) return;
        outcomeHandled = true;
        setRoadAwaitingAuthoritativeOutcome(null);
        silencedRoadEncounterIdRef.current = null;
        if (r.data.noReplay || r.data.legacyClientSettlement) {
          await refreshPlayerRef.current?.({ silent: true });
          return;
        }
        const raw = { ...r.data };
        delete raw.pending;
        if (isRoadAuthoritativeBattleLogReplayable(raw.battleLog)) {
          const logStr = Array.isArray(raw.battleLog) ? raw.battleLog.join('\n') : String(raw.battleLog || '');
          setDefenderAuthoritativeReplayOverlay({
            encounterId: eid,
            battleLogStr: logStr,
            initialAttackerTroops: raw.initialAttackerTroops,
            initialDefenderTroops: raw.initialDefenderTroops,
            leftLabel: '攻方',
            rightLabel: '守军',
            outcomeForModal: raw,
          });
        } else {
          setRoadAuthoritativeOutcomeModal(raw);
        }
        await refreshPlayerRef.current?.({ silent: true });
      } catch {
        setRoadAwaitingAuthoritativeOutcome(null);
        silencedRoadEncounterIdRef.current = null;
      }
    };
    tick();
    const iv = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [roadAwaitingAuthoritativeOutcome?.encounterId, player?.player_id]);

  const overlayGateEpoch = useSyncExternalStore(
    subscribeWorldMapOverlayGate,
    getWorldMapOverlayGateEpoch,
    () => 0,
  );

  const showRoadDefenseEncounterModal =
    !!roadDefenseAlert &&
    !worldMapOverlayRefs.pvpDefenseAlertActive &&
    !(
      worldMapOverlayRefs.siegeRoadEncounterId != null &&
      String(worldMapOverlayRefs.siegeRoadEncounterId) === String(roadDefenseAlert.encounterId)
    );
  void overlayGateEpoch;

  /** 仅在有可见阻塞层时占用 `eventBusy`：`roadAwaiting` 无 UI，不应藏底栏；遇袭被攻城互斥隐藏时同理 */
  useEffect(() => {
    onBusyChange?.(
      !!(
        showRoadDefenseEncounterModal ||
        roadAuthoritativeOutcomeModal ||
        defenderAuthoritativeReplayOverlay
      ),
    );
  }, [
    showRoadDefenseEncounterModal,
    roadAuthoritativeOutcomeModal,
    defenderAuthoritativeReplayOverlay,
    onBusyChange,
  ]);

  const frictionValue = useMemo(
    () => ({
      roadDefenseAlert: !!roadDefenseAlert,
      roadAwaitingAuthoritativeOutcome: !!roadAwaitingAuthoritativeOutcome,
      roadAuthoritativeOutcomeModal: !!roadAuthoritativeOutcomeModal,
      roadDefenseAuthoritativeReplayOpen: !!defenderAuthoritativeReplayOverlay,
      roadDefenseOutcomeReplayBlockingRef,
    }),
    [
      roadDefenseAlert,
      roadAwaitingAuthoritativeOutcome,
      roadAuthoritativeOutcomeModal,
      defenderAuthoritativeReplayOverlay,
    ],
  );

  return (
    <RoadDefenseFrictionContext.Provider value={frictionValue}>
      {children}

      {typeof document !== 'undefined' &&
        defenderAuthoritativeReplayOverlay &&
        createPortal(
          <div className="pointer-events-auto fixed inset-0 z-[235] flex items-center justify-center bg-black/85 px-3 py-6">
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-amber-600/40 bg-[#12121e] p-3 shadow-2xl">
              <div className="text-center text-amber-200/95 text-sm font-bold mb-2">战场演示</div>
              <SiegeReplayMini
                open
                battleLog={defenderAuthoritativeReplayOverlay.battleLogStr}
                leftLabel={defenderAuthoritativeReplayOverlay.leftLabel || '攻方'}
                rightLabel={defenderAuthoritativeReplayOverlay.rightLabel || '守军'}
                initialAttackerTroops={defenderAuthoritativeReplayOverlay.initialAttackerTroops}
                initialDefenderTroops={defenderAuthoritativeReplayOverlay.initialDefenderTroops}
                onPlaybackComplete={() => {
                  const payload = defenderReplayOutcomePayloadRef.current;
                  setDefenderAuthoritativeReplayOverlay(null);
                  if (payload) setRoadAuthoritativeOutcomeModal(payload);
                  refreshPlayerRef.current?.({ silent: true });
                }}
                onClose={() => {
                  const payload = defenderReplayOutcomePayloadRef.current;
                  setDefenderAuthoritativeReplayOverlay(null);
                  if (payload) setRoadAuthoritativeOutcomeModal(payload);
                  refreshPlayerRef.current?.({ silent: true });
                }}
              />
            </div>
          </div>,
          document.body,
        )}

      {!defenderAuthoritativeReplayOverlay && roadAuthoritativeOutcomeModal && (
        <PvpDefenseOutcomeModal
          outcome={roadAuthoritativeOutcomeModal}
          scoreMultiplierLineLabel="PVP积分倍率"
          replayNoticeBlockingRef={roadDefenseOutcomeReplayBlockingRef}
          onClose={() => {
            setRoadAuthoritativeOutcomeModal(null);
            bumpCachesAfterRoadOutcome();
          }}
        />
      )}

      {showRoadDefenseEncounterModal && (
        <AncientModal
          isOpen
          type="warning"
          title="🛤️ 道路遇袭"
          confirmText="确定"
          showCancel={false}
          invokeOnCloseAfterConfirm={false}
          onConfirm={() => roadDefenseAlert && beginRoadDefenseSilence(roadDefenseAlert)}
          onClose={() => roadDefenseAlert && beginRoadDefenseSilence(roadDefenseAlert)}
        >
          <div className="text-center space-y-3">
            <p className="text-gray-800 text-base">
              <span className="font-bold text-red-700">{roadDefenseAlert.attackerName}</span> 在道路上对您发起对战
            </p>
            <p className="text-gray-800">
              点击 <span className="font-semibold text-amber-900">确定</span> 后等待服务端裁定；裁定结束后将弹出与攻城披挂同源的战报演示与评分。
            </p>
            <p className="text-gray-800">
              约 <span className="text-red-700 font-bold text-xl">{roadDefenseAlert.remainingSeconds}</span>{' '}
              秒后本提示将自动关闭（战斗由服务端权威推演，与页签是否在前台无关；关闭后仍请勿离格直至裁定完成）。
            </p>
            <p className="text-gray-500 text-xs">攻城遇袭提示优先显示；若同时存在请先处理城池战事。</p>
          </div>
        </AncientModal>
      )}
    </RoadDefenseFrictionContext.Provider>
  );
}
