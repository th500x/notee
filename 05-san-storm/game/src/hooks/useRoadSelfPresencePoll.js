/**
 * 道路本人 `road_*` 短轮询 + 退让提示暂存/弹出（原 WorldMap.jsx 700ms tick）。
 */
import { useState, useRef, useEffect } from 'react';
import { playerAPI } from '@/services/playerApi';

function isRoadGateNoticeBlocked(blockSnapshot, blockTutorialAutoplay, roadDefenseOutcomeReplayBlockingRef) {
  if (blockTutorialAutoplay) return true;
  if (!blockSnapshot || typeof blockSnapshot !== 'object') return false;
  return (
    blockSnapshot.authoritativeReplayOverlay ||
    blockSnapshot.siegeResult ||
    blockSnapshot.siegeData ||
    blockSnapshot.banditRaidData ||
    blockSnapshot.banditRaidResult ||
    blockSnapshot.roadAuthoritativeOutcomeModal ||
    blockSnapshot.pvpAttackerAdjudicating ||
    blockSnapshot.pvpDefenseOutcome ||
    blockSnapshot.roadAttackerAlert ||
    blockSnapshot.pvpChallenge ||
    blockSnapshot.roadDefenseAlert ||
    blockSnapshot.roadAwaitingAuthoritativeOutcome ||
    !!roadDefenseOutcomeReplayBlockingRef?.current
  );
}

export function useRoadSelfPresencePoll({
  playerId,
  refreshPlayer,
  blockTutorialAutoplay = false,
  roadNoticeUiBlockRef,
  roadDefenseOutcomeReplayBlockingRef,
  bumpStrategicRoadPresenceRef,
  strategicRoadMarchAnimatingRef,
  intervalMs = 700,
  noticeUnblockDeps = [],
}) {
  const [roadGateRetreatNotice, setRoadGateRetreatNotice] = useState(null);
  const deferredRoadGateNoticeRef = useRef(null);
  const lastApiRoadSnapRef = useRef('');

  useEffect(() => {
    if (!playerId) {
      lastApiRoadSnapRef.current = '';
      return undefined;
    }
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const res = await playerAPI.getRoadSelf(playerId);
        if (cancelled || !res?.success || !res.data) return;
        const d = res.data;
        const j = d.roadJunId != null ? String(d.roadJunId) : '';
        const snap = `${j}|${d.roadPositionX}|${d.roadPositionY}`;
        if (strategicRoadMarchAnimatingRef?.current) {
          lastApiRoadSnapRef.current = snap;
          return;
        }
        const notice = typeof d.pendingRoadNotice === 'string' ? d.pendingRoadNotice.trim() : '';
        if (notice) {
          const blocked = isRoadGateNoticeBlocked(
            roadNoticeUiBlockRef?.current,
            blockTutorialAutoplay,
            roadDefenseOutcomeReplayBlockingRef,
          );
          if (blocked) {
            deferredRoadGateNoticeRef.current = notice;
          } else {
            setRoadGateRetreatNotice(notice);
          }
        }
        if (lastApiRoadSnapRef.current === '') {
          lastApiRoadSnapRef.current = snap;
          if (notice) {
            await refreshPlayer({ silent: true });
            bumpStrategicRoadPresenceRef?.current?.();
          }
          return;
        }
        if (snap !== lastApiRoadSnapRef.current || notice) {
          lastApiRoadSnapRef.current = snap;
          await refreshPlayer({ silent: true });
          bumpStrategicRoadPresenceRef?.current?.();
        }
        const queued = deferredRoadGateNoticeRef.current;
        if (queued) {
          const stillBlocked = isRoadGateNoticeBlocked(
            roadNoticeUiBlockRef?.current,
            blockTutorialAutoplay,
            roadDefenseOutcomeReplayBlockingRef,
          );
          if (!stillBlocked) {
            deferredRoadGateNoticeRef.current = null;
            setRoadGateRetreatNotice(queued);
          }
        }
      } catch {
        /* 静默 */
      }
    };
    lastApiRoadSnapRef.current = '';
    tick();
    const iv = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [
    playerId,
    refreshPlayer,
    blockTutorialAutoplay,
    intervalMs,
    roadNoticeUiBlockRef,
    roadDefenseOutcomeReplayBlockingRef,
    bumpStrategicRoadPresenceRef,
    strategicRoadMarchAnimatingRef,
  ]);

  /** 阻塞 UI 关闭后立刻弹出已暂存的退让提示（由调用方传入与 roadNoticeUiBlockRef 同步的 deps） */
  useEffect(() => {
    const queued = deferredRoadGateNoticeRef.current;
    if (!queued) return;
    const stillBlocked = isRoadGateNoticeBlocked(
      roadNoticeUiBlockRef?.current,
      blockTutorialAutoplay,
      roadDefenseOutcomeReplayBlockingRef,
    );
    if (!stillBlocked) {
      deferredRoadGateNoticeRef.current = null;
      setRoadGateRetreatNotice(queued);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- noticeUnblockDeps 由 WorldMap 显式传入
  }, [
    blockTutorialAutoplay,
    roadNoticeUiBlockRef,
    roadDefenseOutcomeReplayBlockingRef,
    ...(Array.isArray(noticeUnblockDeps) ? noticeUnblockDeps : []),
  ]);

  return {
    roadGateRetreatNotice,
    setRoadGateRetreatNotice,
    deferredRoadGateNoticeRef,
  };
}

export default useRoadSelfPresencePoll;
