/**
 * 封赏卡池半天抽取额度刷新时刻（与 `cardPoolService.HALF_DAY_START_SQL` / 13-3 §5.1 一致）。
 * 墙钟：08:00 晨窗 · 12:00 午间起窗（跨 00:00～07:59 仍属前一日 12:00 窗）。
 */

/**
 * @param {Date} [now]
 * @returns {Date} 下一半天窗起点（本地墙钟）
 */
export function getNextCardPoolDrawRefreshAt(now = new Date()) {
  const d = new Date(now);
  const y = d.getFullYear();
  const mo = d.getMonth();
  const day = d.getDate();
  const h = d.getHours();

  if (h >= 12) {
    return new Date(y, mo, day + 1, 8, 0, 0, 0);
  }
  if (h >= 8) {
    return new Date(y, mo, day, 12, 0, 0, 0);
  }
  return new Date(y, mo, day, 8, 0, 0, 0);
}

/**
 * @param {Date} nextAt
 * @param {number} [nowMs]
 * @returns {string}
 */
export function formatCardPoolDrawRefreshCountdown(nextAt, nowMs = Date.now()) {
  const ms = nextAt.getTime() - nowMs;
  if (!Number.isFinite(ms) || ms <= 0) return '即将刷新';
  const totalMinutes = Math.ceil(ms / 60_000);
  if (totalMinutes <= 0) return '即将刷新';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}时${m}分后刷新`;
  return `${totalMinutes}分钟后刷新`;
}
