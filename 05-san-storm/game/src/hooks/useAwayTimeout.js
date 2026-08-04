/**
 * 离开页面超时自动结算逻辑（visibilitychange + 定时器）。
 * 适用于 pve_event / pve_siege；大型图关闭此功能（enabled=false）。
 *
 * 返回的 pendingAwayNoticeRef 由结算 hook（useBattleSettlement）读取，
 * 以决定是否弹出「已自动结算」提示。
 */
import { useEffect, useRef, useCallback } from 'react';
import { setBattleAnimationSkipDelays } from '@/battle/tacticalBattleEngine';

const PVE_AWAY_TIMEOUT_MS = 30000;

/**
 * @param {boolean}  enabled         - 是否启用（pve_event/pve_siege 为 true，大型图为 false）
 * @param {boolean}  battlePlaying   - 当前 bm.battlePlaying
 * @param {object}   autoBattleRef   - useRef(bm.autoBattle)，由外层持续同步
 */
export function useAwayTimeout({ enabled, battlePlaying, autoBattleRef }) {
  const battlePlayingRef = useRef(battlePlaying);
  battlePlayingRef.current = battlePlaying;

  const awayHandledRef = useRef(false);
  const pendingAwayNoticeRef = useRef(false);
  const awayDeadlineRef = useRef(null);
  const awayTimerRef = useRef(null);

  const handleAwayDeadline = useCallback(() => {
    if (!enabled || awayHandledRef.current) return;
    if (!battlePlayingRef.current || !autoBattleRef.current) return;
    awayHandledRef.current = true;
    pendingAwayNoticeRef.current = true;
    setBattleAnimationSkipDelays(true);
  }, [enabled, autoBattleRef]);

  // 新一轮战斗开始时重置所有状态
  useEffect(() => {
    if (!enabled || !battlePlaying) return;
    awayHandledRef.current = false;
    pendingAwayNoticeRef.current = false;
    awayDeadlineRef.current = null;
    if (awayTimerRef.current) {
      clearTimeout(awayTimerRef.current);
      awayTimerRef.current = null;
    }
  }, [enabled, battlePlaying]);

  // 监听页面可见性，隐藏时启动倒计时，回来时检查是否超时
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;
    const onVis = () => {
      if (document.hidden) {
        if (!battlePlayingRef.current || !autoBattleRef.current) return;
        awayDeadlineRef.current = Date.now() + PVE_AWAY_TIMEOUT_MS;
        if (awayTimerRef.current) clearTimeout(awayTimerRef.current);
        awayTimerRef.current = setTimeout(handleAwayDeadline, PVE_AWAY_TIMEOUT_MS);
      } else {
        if (awayTimerRef.current) {
          clearTimeout(awayTimerRef.current);
          awayTimerRef.current = null;
        }
        const dl = awayDeadlineRef.current;
        if (dl != null) {
          if (Date.now() >= dl) handleAwayDeadline();
          awayDeadlineRef.current = null;
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (awayTimerRef.current) {
        clearTimeout(awayTimerRef.current);
        awayTimerRef.current = null;
      }
    };
  }, [enabled, handleAwayDeadline]);

  return { pendingAwayNoticeRef, awayHandledRef };
}
