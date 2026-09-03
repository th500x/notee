/**
 * 道路本人 `road_*` 短轮询 + 退让提示暂存/弹出（原 WorldMap.jsx 700ms tick）。
 *
 * 道路同格遭遇战已归档（`_archive/dao-lu-yu-di/`）：本 hook 只负责坐标同步与
 * `road_client_notice`（门闸退让 / 路点修复 / 攻城战败退让）的排队展示。
 */
import { useState, useRef, useEffect } from 'react';
import { playerAPI } from '@/services/playerApi';

export function isRoadGateNoticeBlocked(blockSnapshot, blockTutorialAutoplay) {
  if (blockTutorialAutoplay) return true;
  if (!blockSnapshot || typeof blockSnapshot !== 'object') return false;
  return (
    blockSnapshot.authoritativeReplayOverlay ||
    blockSnapshot.siegeResult ||
    blockSnapshot.siegeData ||
    blockSnapshot.banditRaidData ||
    blockSnapshot.banditRaidResult ||
    blockSnapshot.pvpAttackerAdjudicating ||
    blockSnapshot.pvpDefenseSettlement ||
    blockSnapshot.pvpChallenge
  );
}

export function useRoadSelfPresencePoll({
  playerId,
  refreshPlayer,
  blockTutorialAutoplay = false,
  roadNoticeUiBlockRef,
  bumpStrategicRoadPresenceRef,
  strategicRoadMarchAnimatingRef,
  intervalMs = 700,
  noticeUnblockDeps = [],
}) {
  const [roadGateRetreatNotice, setRoadGateRetreatNotice] = useState(null);
  const deferredRoadGateNoticeRef = useRef(null);
  const lastApiRoadSnapRef = useRef('');
  /** 已展示/入队的文案：轮询与 repair-stand 响应交叉时禁止叠第二次 */
  const shownRoadGateNoticeRef = useRef('');

  const applyRoadGateNotice = (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    if (shownRoadGateNoticeRef.current === trimmed) return;
    shownRoadGateNoticeRef.current = trimmed;
    setRoadGateRetreatNotice(trimmed);
  };

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
          );
          if (blocked) {
            deferredRoadGateNoticeRef.current = notice;
          } else {
            applyRoadGateNotice(notice);
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
          );
          if (!stillBlocked) {
            deferredRoadGateNoticeRef.current = null;
            applyRoadGateNotice(queued);
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
    );
    if (!stillBlocked) {
      deferredRoadGateNoticeRef.current = null;
      applyRoadGateNotice(queued);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- noticeUnblockDeps 由 WorldMap 显式传入
  }, [
    blockTutorialAutoplay,
    roadNoticeUiBlockRef,
    ...(Array.isArray(noticeUnblockDeps) ? noticeUnblockDeps : []),
  ]);

  const clearRoadGateRetreatNotice = () => {
    shownRoadGateNoticeRef.current = '';
    setRoadGateRetreatNotice(null);
  };

  return {
    roadGateRetreatNotice,
    setRoadGateRetreatNotice: clearRoadGateRetreatNotice,
    applyRoadGateNotice,
    deferredRoadGateNoticeRef,
    shownRoadGateNoticeRef,
  };
}

/** 战败/退让提示入队（结算关闭后调用；与轮询 `pendingRoadNotice` 互补） */
export function enqueueRoadGateRetreatNotice(
  text,
  {
    setRoadGateRetreatNotice,
    applyRoadGateNotice,
    deferredRoadGateNoticeRef,
    shownRoadGateNoticeRef,
    blockSnapshot,
    blockTutorialAutoplay,
  },
) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return;
  if (shownRoadGateNoticeRef?.current === trimmed) return;
  if (isRoadGateNoticeBlocked(blockSnapshot, blockTutorialAutoplay)) {
    deferredRoadGateNoticeRef.current = trimmed;
    return;
  }
  if (typeof applyRoadGateNotice === 'function') {
    applyRoadGateNotice(trimmed);
    return;
  }
  if (shownRoadGateNoticeRef) shownRoadGateNoticeRef.current = trimmed;
  setRoadGateRetreatNotice(trimmed);
}

export default useRoadSelfPresencePoll;
