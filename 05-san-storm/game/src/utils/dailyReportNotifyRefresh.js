/**
 * 真三日报签到成功后通知红点 hook 立即重查。
 */

const listeners = new Set();

export function subscribeDailyReportNotifyRefresh(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyDailyReportNotifyRefresh() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}
