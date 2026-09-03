/**
 * 成就可领取红点：在领取成功或档案刷新后通知轮询 hook 立即重查。
 */

const listeners = new Set();

/** @param {() => void} cb */
export function subscribeAchievementNotifyRefresh(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function notifyAchievementNotifyRefresh() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      /* ignore */
    }
  });
}
