/**
 * 卡池抽取 Hook
 * 
 * @module game/hooks/useCardPool
 */

import { useState, useCallback } from 'react';
import { cardPoolAPI } from '../services/cardPoolApi';

/**
 * @param {string} playerId - 玩家ID
 */
export function useCardPool(playerId) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [choiceLoading, setChoiceLoading] = useState(false);
  const [drawResult, setDrawResult] = useState(null);
  const [duplicateChoiceError, setDuplicateChoiceError] = useState(null);
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

  /** 执行抽取 */
  const draw = useCallback(async (poolType, poolSeason) => {
    if (!playerId) return;
    setLoading(true);
    setError(null);
    setDuplicateChoiceError(null);
    setDrawResult(null);
    try {
      const res = await cardPoolAPI.draw(playerId, poolType, poolSeason);
      if (res.success) {
        setDrawResult(res);
        // 同步更新本地状态
        setStatus(prev => prev ? {
          ...prev,
          silver: res.remainingSilver,
          [poolType]: {
            ...prev[poolType],
            remainingDraws: res.remainingDraws,
            pityCount: res.pityCount,
          },
        } : prev);
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
    setDuplicateChoiceError(null);
  }, []);

  /** 卡池重复三选一 */
  const resolveDuplicateChoice = useCallback(async (choice) => {
    if (!playerId || !drawResult?.pendingDuplicateDrawId) {
      return { success: false, error: '无待处理的重复选择' };
    }
    setChoiceLoading(true);
    setDuplicateChoiceError(null);
    try {
      const res = await cardPoolAPI.resolveDuplicateChoice(
        playerId,
        drawResult.pendingDuplicateDrawId,
        choice,
      );
      if (res.success) {
        setDrawResult((prev) => (prev ? { ...prev, duplicateChoiceResolved: res } : prev));
        if (res.remainingSilver != null) {
          setStatus((prev) => (prev ? { ...prev, silver: res.remainingSilver } : prev));
        }
      } else {
        setDuplicateChoiceError(res.error || '处理失败');
      }
      return res;
    } catch (e) {
      setDuplicateChoiceError(e.message);
      return { success: false, error: e.message };
    } finally {
      setChoiceLoading(false);
    }
  }, [playerId, drawResult?.pendingDuplicateDrawId]);

  return {
    status,
    loading,
    choiceLoading,
    drawResult,
    duplicateChoiceError,
    error,
    loadStatus,
    draw,
    clearResult,
    resolveDuplicateChoice,
  };
}
