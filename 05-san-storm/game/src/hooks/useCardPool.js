/**
 * 卡池抽取 Hook
 * 
 * @module game/hooks/useCardPool
 */

import { useState, useCallback } from 'react';
import { cardPoolAPI } from '../services/cardPoolApi';

/** 将 status 中的 pendingEchoChoice 转为 drawResult 形态，便于恢复弹窗 */
function drawResultFromPendingEcho(pending) {
  if (!pending?.pendingEchoDrawId) return null;
  return {
    success: true,
    echoChoiceRequired: true,
    pendingEchoDrawId: pending.pendingEchoDrawId,
    echoState: pending.echoState,
    cards: [{
      cardId: pending.cardId,
      cardName: pending.cardName,
      rarity: pending.rarity,
      echoChoiceRequired: true,
    }],
    resumed: true,
  };
}

/**
 * @param {string} playerId - 玩家ID
 */
export function useCardPool(playerId) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [choiceLoading, setChoiceLoading] = useState(false);
  const [drawResult, setDrawResult] = useState(null);
  const [echoChoiceError, setEchoChoiceError] = useState(null);
  const [error, setError] = useState(null);

  /**
   * 加载卡池状态（剩余次数、保底、费用等）。
   * 不切换 `loading`：该标志仅用于 **抽取请求** 进行中，避免打开抽屉时 `loadStatus` 与底部「抽取」按钮共用状态导致整栏闪烁。
   */
  const loadStatus = useCallback(async () => {
    if (!playerId) return null;
    setError(null);
    try {
      const res = await cardPoolAPI.getStatus(playerId);
      if (res.success) {
        setStatus(res);
      } else {
        setError(res.error);
      }
      return res;
    } catch (e) {
      setError(e.message);
      return { success: false, error: e.message };
    }
  }, [playerId]);

  /** 执行抽取：`batch` 银两十连 · `badge_batch` 真三徽章抽（各 12 次，半天窗独立） */
  const draw = useCallback(async (poolType, poolSeason, drawMode = 'batch') => {
    if (!playerId) return;
    setLoading(true);
    setError(null);
    setEchoChoiceError(null);
    setDrawResult(null);
    try {
      const res = await cardPoolAPI.draw(playerId, poolType, poolSeason, drawMode);
      if (res.success) {
        setDrawResult(res);
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                silver: res.remainingSilver ?? prev.silver,
                stormBadgeCount:
                  res.stormBadgeRemaining != null ? res.stormBadgeRemaining : prev.stormBadgeCount,
                [poolType]: {
                  ...prev[poolType],
                  remainingDraws: res.remainingDraws ?? res.remainingSlots,
                  remainingSlots: res.remainingSlots ?? res.remainingDraws,
                  nextDrawCost: null,
                  canBatchDraw: res.canSilverBatch ?? false,
                  canSilverBatch: res.canSilverBatch ?? false,
                  canBadgeBatch: res.canBadgeBatch ?? false,
                  pityCount: res.pityCount ?? prev[poolType]?.pityCount,
                },
              }
            : prev,
        );
      } else {
        setError(res.error);
      }
      return res;
    } catch (e) {
      setError(e.message);
      return { success: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  /** 清除抽取结果（关闭结果弹窗时调用） */
  const clearResult = useCallback(() => {
    setDrawResult(null);
    setEchoChoiceError(null);
  }, []);

  /**
   * 打开将领卡池时恢复未完成的重复三选一（仅 character 抽屉应调用）
   * @param {object} [pending] - 可选；默认读 status.pendingEchoChoice
   */
  const resumePendingEcho = useCallback((pending) => {
    const p = pending ?? status?.pendingEchoChoice;
    if (!p?.pendingEchoDrawId) return;
    setDrawResult((prev) => {
      if (prev?.pendingEchoDrawId === p.pendingEchoDrawId) return prev;
      if (prev?.echoChoiceRequired && !prev.resumed) return prev;
      return drawResultFromPendingEcho(p);
    });
  }, [status?.pendingEchoChoice]);

  /** 卡池重复残影三选一 */
  const resolveEchoChoice = useCallback(async (choice, pendingEchoDrawId) => {
    const drawId = pendingEchoDrawId ?? drawResult?.pendingEchoDrawId;
    if (!playerId || !drawId) {
      return { success: false, error: '无待处理的重复选择' };
    }
    setChoiceLoading(true);
    setEchoChoiceError(null);
    try {
      const res = await cardPoolAPI.resolveEchoChoice(
        playerId,
        drawId,
        choice,
      );
      if (res.success) {
        if (res.remainingSilver != null) {
          setStatus((prev) => (prev ? {
            ...prev,
            silver: res.remainingSilver,
            pendingEchoChoice: null,
          } : prev));
        } else {
          setStatus((prev) => (prev ? { ...prev, pendingEchoChoice: null } : prev));
        }
      } else {
        setEchoChoiceError(res.error || '处理失败');
      }
      return res;
    } catch (e) {
      setEchoChoiceError(e.message);
      return { success: false, error: e.message };
    } finally {
      setChoiceLoading(false);
    }
  }, [playerId, drawResult?.pendingEchoDrawId, status?.pendingEchoChoice]);

  return {
    status,
    loading,
    choiceLoading,
    drawResult,
    echoChoiceError,
    error,
    loadStatus,
    draw,
    clearResult,
    resumePendingEcho,
    resolveEchoChoice,
  };
}
