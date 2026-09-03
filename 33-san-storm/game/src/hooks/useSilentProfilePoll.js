/**
 * 编组类页面打开期间，按固定周期"静默" `refresh({ silent: true })` 拉一次玩家档案，
 * 让兵力自然恢复 / 资源滴答等不需要整页刷新就能在 UI 上看到。
 *
 * `LineupTab`（上阵编组）与 `GarrisonLineup`（驻地编组）原本各写一份 60s setInterval，
 * CR C5（2026-04-29）抽到此 hook 复用。
 *
 * @param {(opts?: { silent?: boolean }) => void} refresh `usePlayerContext().refresh`
 * @param {number} [intervalMs=60_000] 周期，毫秒
 */
import { useEffect } from 'react';

export function useSilentProfilePoll(refresh, intervalMs = 60_000) {
  useEffect(() => {
    if (typeof refresh !== 'function') return undefined;
    refresh({ silent: true });
    const id = setInterval(() => refresh({ silent: true }), intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);
}

export default useSilentProfilePoll;
