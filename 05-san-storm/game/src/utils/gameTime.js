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
