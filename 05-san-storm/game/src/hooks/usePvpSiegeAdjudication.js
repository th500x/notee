/**
 * PVP 攻城裁定：攻方 `siege-resolve` 定时 + 守方 `siege-outcome` 轮询（原 WorldMap.jsx）。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import { scheduleAfterMinAdjudicationUi } from '@/utils/pvpSiegeTiming';

export function usePvpSiegeAdjudication({
  playerId,
  refreshPlayer,
  onGarrisonStatsBump,
  setSiegeResult,
  setSimpleAlertMessage,
}) {
  const [pvpChallenge, setPvpChallenge] = useState(null);
  const [pvpCountdown, setPvpCountdown] = useState(0);
  const [pvpDefenseWaiting, setPvpDefenseWaiting] = useState(null);
  const [pvpDefenseOutcome, setPvpDefenseOutcome] = useState(null);
  const [pvpAttackerAdjudicating, setPvpAttackerAdjudicating] = useState(null);
  const [authoritativeReplayOverlay, setAuthoritativeReplayOverlay] = useState(null);

  const pvpTimerRef = useRef(null);
  const pvpResolveOnceRef = useRef(false);
  const pvpDefenseOutcomeHandledRef = useRef(false);

  // 攻方：deadline 触发 siege-resolve → 最短裁定 UI → 简化回放 → 结算
  useEffect(() => {
    if (!pvpChallenge || !playerId) return;
    pvpResolveOnceRef.current = false;

    const runResolve = async () => {
      if (pvpResolveOnceRef.current) return;
      pvpResolveOnceRef.current = true;
      if (pvpTimerRef.current) clearTimeout(pvpTimerRef.current);
      const ch = pvpChallenge;
      const adjudicationStartedAt = Date.now();
      setPvpAttackerAdjudicating({
        defenderName: ch.defenderName || '未知',
        startedAt: adjudicationStartedAt,
      });
      setPvpChallenge(null);
      try {
        const r = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/pvp/siege-resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId: ch.challengeId, attackerId: playerId }),
        }).then((x) => x.json());
        if (r.success && r.data?.siegeData) {
          const siegeResultSnapshot = {
            ...r.data.siegeData,
            authoritativeBattleLog: r.data.battleLog,
            battleSeed: r.data.battleSeed,
            siegeReplayAttackerNames: r.data.siegeReplayAttackerNames,
            siegeReplayDefenderNames: r.data.siegeReplayDefenderNames,
            initialAttackerTroops: r.data.initialAttackerTroops,
            initialDefenderTroops: r.data.initialDefenderTroops,
          };
          const logStr = Array.isArray(r.data.battleLog) ? r.data.battleLog.join('\n') : '';
          scheduleAfterMinAdjudicationUi(adjudicationStartedAt, () => {
            setPvpAttackerAdjudicating(null);
            setAuthoritativeReplayOverlay({
              battleLogStr: logStr,
              initialAttackerTroops: r.data.initialAttackerTroops,
              initialDefenderTroops: r.data.initialDefenderTroops,
              leftLabel: '攻方',
              rightLabel: '守军',
              onPlaybackComplete: () => {
                setAuthoritativeReplayOverlay(null);
                setSiegeResult(siegeResultSnapshot);
                onGarrisonStatsBump?.();
                refreshPlayer({ silent: true });
              },
            });
          });
        } else {
          scheduleAfterMinAdjudicationUi(adjudicationStartedAt, () => {
            setPvpAttackerAdjudicating(null);
            setSimpleAlertMessage?.(r.error || '攻城结算失败');
          });
        }
      } catch (e) {
        console.error('[PVP] siege-resolve', e);
        scheduleAfterMinAdjudicationUi(adjudicationStartedAt, () => {
          setPvpAttackerAdjudicating(null);
          setSimpleAlertMessage?.('攻城结算请求失败');
        });
      }
    };

    const endsAt = Number(pvpChallenge.countdownEndsAt) || Date.now() + 10_000;
    const delay = Math.max(0, endsAt - Date.now());
    pvpTimerRef.current = setTimeout(runResolve, delay);

    const onVis = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      if (Date.now() < endsAt) return;
      clearTimeout(pvpTimerRef.current);
      runResolve();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);

    return () => {
      clearTimeout(pvpTimerRef.current);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    };
  }, [pvpChallenge, playerId, refreshPlayer, onGarrisonStatsBump, setSiegeResult, setSimpleAlertMessage]);

  // 守方：已确认遇袭 → 轮询 siege-outcome
  useEffect(() => {
    if (!pvpDefenseWaiting?.challengeId || !playerId) {
      pvpDefenseOutcomeHandledRef.current = false;
      return;
    }
    pvpDefenseOutcomeHandledRef.current = false;
    const poll = async () => {
      if (pvpDefenseOutcomeHandledRef.current) return;
      try {
        const r = await fetchWithTimeout(
          `${API_CONFIG.BASE_URL}/pvp/challenge/${pvpDefenseWaiting.challengeId}/siege-outcome?playerId=${encodeURIComponent(playerId)}`,
        ).then((x) => x.json());
        if (r.success && r.outcome && !pvpDefenseOutcomeHandledRef.current) {
          pvpDefenseOutcomeHandledRef.current = true;
          const startedAt = pvpDefenseWaiting.startedAt ?? Date.now();
          const outcome = r.outcome;
          scheduleAfterMinAdjudicationUi(startedAt, () => {
            setPvpDefenseWaiting(null);
            setPvpDefenseOutcome(outcome);
            onGarrisonStatsBump?.();
            refreshPlayer({ silent: true });
          });
        }
      } catch {
        /* 静默 */
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [pvpDefenseWaiting, playerId, refreshPlayer, onGarrisonStatsBump]);

  const beginDefenseFollowUp = useCallback((alert, dismissPvpDefenseAlert) => {
    if (!alert?.challengeId) return;
    dismissPvpDefenseAlert(alert.challengeId);
    setPvpDefenseWaiting({
      challengeId: alert.challengeId,
      attackerName: alert.attackerName || '未知',
      startedAt: Date.now(),
    });
  }, []);

  return {
    pvpChallenge,
    setPvpChallenge,
    pvpCountdown,
    setPvpCountdown,
    pvpDefenseWaiting,
    setPvpDefenseWaiting,
    pvpDefenseOutcome,
    setPvpDefenseOutcome,
    pvpAttackerAdjudicating,
    authoritativeReplayOverlay,
    setAuthoritativeReplayOverlay,
    beginDefenseFollowUp,
  };
}

export default usePvpSiegeAdjudication;
