/**
 * 游戏内历法（基于 config_servers，按月30天推算）
 * @module backend/services/gameTimeService
 */

const DAYS_PER_GAME_MONTH = 30;

/**
 * 从锚点日期起加上若干游戏整日（每月固定30天）
 */
function advanceGameCalendar(startYear, startMonth, startDay, daysToAdd) {
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
 * 根据 config_servers 一行计算当前游戏日期
 * @param {object|null} row
 * @returns {object|null}
 */
function computeGameTimeFromServerRow(row) {
  if (!row) return null;

  const anchorStr = row.season_start_time || row.opened_at;
  if (!anchorStr) return null;

  const anchor = new Date(anchorStr);
  if (Number.isNaN(anchor.getTime())) return null;

  const elapsedMs = Math.max(0, Date.now() - anchor.getTime());
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const hoursPerGameDay = Math.max(
    1e-6,
    Number(row.game_time_real_hours_per_game_day ?? 1)
  );
  const elapsedGameDays = Math.floor(elapsedHours / hoursPerGameDay);

  const sy = row.game_time_start_year ?? 184;
  const sm = row.game_time_start_month ?? 1;
  const sd = row.game_time_start_day ?? 1;

  const { year, month, day } = advanceGameCalendar(sy, sm, sd, elapsedGameDays);

  return {
    serverId: row.server_id,
    year,
    month,
    day,
    startYear: sy,
    startMonth: sm,
    startDay: sd,
    elapsedGameDays,
    realHoursPerGameDay: hoursPerGameDay,
    anchorAt: anchorStr,
  };
}

module.exports = {
  DAYS_PER_GAME_MONTH,
  advanceGameCalendar,
  computeGameTimeFromServerRow,
};
