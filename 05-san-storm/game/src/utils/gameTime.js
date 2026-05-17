/**
 * 与 backend/services/gameTimeService 一致的历法推算（客户端每分钟刷新显示）
 */

const DAYS_PER_GAME_MONTH = 30;

export function advanceGameCalendar(startYear, startMonth, startDay, daysToAdd) {
  let year = Number(startYear) || 184;
  let month = Number(startMonth) || 1;
  let day = Number(startDay) || 1;
  day += Math.max(0, Math.floor(Number(daysToAdd) || 0));

  while (day > DAYS_PER_GAME_MONTH) {
    day -= DAYS_PER_GAME_MONTH;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return { year, month, day };
}

/**
 * @param {object} gt profile 返回的 gameTime（含 anchorAt、起点与流速）
 */
export function computeDisplayGameDate(gt) {
  if (!gt?.anchorAt) return null;
  const anchor = new Date(gt.anchorAt).getTime();
  if (Number.isNaN(anchor)) return { year: gt.year, month: gt.month, day: gt.day };
  const elapsedMs = Math.max(0, Date.now() - anchor);
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const hoursPer = Math.max(1e-6, Number(gt.realHoursPerGameDay) || 1);
  const elapsedGameDays = Math.floor(elapsedHours / hoursPer);
  return advanceGameCalendar(gt.startYear, gt.startMonth, gt.startDay, elapsedGameDays);
}

/**
 * 与 `warInitiationCostService.gameCalendarMonthOrdinal` 一致：当前游戏历第几个自然月（1 起算），用于 UI 与 17-2 发动倍率说明。
 * @param {object|null|undefined} gt - profile `gameTime`（须含 year/month/startYear/startMonth）
 * @returns {number}
 */
export function gameCalendarMonthOrdinal(gt) {
  if (!gt) return 1;
  const y = Number(gt.year);
  const m = Number(gt.month);
  const sy = Number(gt.startYear ?? 184);
  const sm = Number(gt.startMonth ?? 1);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(sy) || !Number.isFinite(sm)) {
    return 1;
  }
  const abs = (yy, mm) => yy * 12 + (mm - 1);
  const delta = abs(y, m) - abs(sy, sm);
  return Math.max(1, delta + 1);
}
