/**
 * PVP 守城遇袭轮询 hook
 *
 * @description
 *   把 `WorldMap.jsx` 中的"PVP 防守方遇袭通知"轮询独立出来，行为零变动：
 *     - 每 `intervalMs`（默认 3000ms）调一次 `GET /pvp/pending/:playerId`；
 *     - 命中未被静默的 challenge → `setAlert(challenge)` 并触发桌面通知（`Notification`，
 *       未授权时静默 `requestPermission()`，与原产品口径一致）；
 *     - 服务端报"无 challenge" → 自动复位静默 ID，让下一次新 challenge 仍能弹窗；
 *     - 用户主动 `dismiss(challengeId)` 或战后弹窗关闭 `reset()` —— 控制静默生命周期。
 *   `enabled=false` 或 `playerId` 为空时不发起轮询；卸载 / 切换 player 时清理 timer 与 in-flight tick。
 *
 *   与 `services/httpClient.js` 协作：自动附 `Authorization: Bearer <playerJwt>`，无需调用方关心。
 *
 * @param {{ playerId: string|null|undefined, enabled: boolean, intervalMs?: number }} options
 * @returns {{ alert: object|null, setAlert: Function, dismiss: (challengeId: string) => void, reset: () => void }}
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';

export function usePvpDefenseAlertPoll({ playerId, enabled, intervalMs = 3000 } = {}) {
  const [alert, setAlert] = useState(null);
  const silencedRef = useRef(null);

  useEffect(() => {
    if (!playerId || !enabled) return undefined;
    let cancelled = false;
    const pollPending = async () => {
      if (cancelled) return;
      try {
        const res = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/pvp/pending/${playerId}`).then((r) => r.json());
        if (cancelled) return;
        if (res.success && res.challenge) {
          const c = res.challenge;
          if (silencedRef.current && silencedRef.current === c.challengeId) {
            return;
          }
          if (silencedRef.current && silencedRef.current !== c.challengeId) {
            silencedRef.current = null;
          }
          setAlert(c);
          if (typeof Notification !== 'undefined') {
            if (Notification.permission === 'granted') {
              new Notification('🏰 城池遭袭', {
                body: `${c.attackerName} 正在攻打我方城池，${c.remainingSeconds} 秒内可点确定查看战报`,
                tag: 'siege-pvp',
              });
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission();
            }
          }
        } else if (res.success && !res.challenge) {
          silencedRef.current = null;
        }
      } catch {}
    };
    pollPending();
    const id = setInterval(pollPending, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [playerId, enabled, intervalMs]);

  /** 用户主动确认 / 超时关闭：把该 challengeId 列入静默，至下一轮"无 challenge"自动放开。 */
  const dismiss = useCallback((challengeId) => {
    if (challengeId) silencedRef.current = challengeId;
    setAlert(null);
  }, []);

  /** 强制复位静默（如战后结算 modal 关闭后） */
  const reset = useCallback(() => {
    silencedRef.current = null;
  }, []);

  return { alert, setAlert, dismiss, reset };
}

export default usePvpDefenseAlertPoll;
