/**
 * 游戏内历法（基于 config_servers，按月30天推算）
 * @module backend/services/gameTimeService
 */

const { pool } = require('../database/connection');

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

/**
 * 查询玩家所在服务器，计算当前游戏历法。
 * 多处服务（chapterService、playerProfileService 等）共用此函数，
 * 不再各自重复实现。失败时返回 null，不阻断调用方主流程。
 *
 * @param {string} playerId - 玩家 ID（对应 accounts.id）
 * @returns {Promise<object|null>} gameTime 对象或 null
 */
async function loadGameTimeForPlayer(playerId) {
  try {
    const [accRows] = await pool.query('SELECT serverId FROM accounts WHERE id = ?', [playerId]);
    const serverId = accRows[0]?.serverId;
    if (!serverId) return null;
    const [srvRows] = await pool.query(
      `SELECT server_id, opened_at, season_start_time,
              game_time_start_year, game_time_start_month, game_time_start_day,
              game_time_real_hours_per_game_day
       FROM config_servers WHERE server_id = ?`,
      [serverId],
    );
    return computeGameTimeFromServerRow(srvRows[0]);
  } catch (e) {
    console.warn('[gameTimeService] loadGameTimeForPlayer:', e.message);
    return null;
  }
}

/**
 * 取势力内任意一员的 `serverId` 推算游戏历（与 `loadGameTimeForPlayer` 同源 config_servers）。
 * AI 君主主动开战等无 proposer 玩家时使用。
 *
 * @param {string} factionId
 * @returns {Promise<object|null>}
 */
async function loadGameTimeForFaction(factionId) {
  const fid = String(factionId || '').trim();
  if (!fid) return null;
  try {
    const [rows] = await pool.query(
      `SELECT a.serverId AS serverId
       FROM players p
       INNER JOIN accounts a ON a.id = p.player_id
       WHERE p.faction_id = ?
       LIMIT 1`,
      [fid],
    );
    const serverId = rows[0]?.serverId;
    if (!serverId) return null;
    const [srvRows] = await pool.query(
      `SELECT server_id, opened_at, season_start_time,
              game_time_start_year, game_time_start_month, game_time_start_day,
              game_time_real_hours_per_game_day
       FROM config_servers WHERE server_id = ?`,
      [serverId],
    );
    return computeGameTimeFromServerRow(srvRows[0]);
  } catch (e) {
    console.warn('[gameTimeService] loadGameTimeForFaction:', e.message);
    return null;
  }
}

module.exports = {
  DAYS_PER_GAME_MONTH,
  advanceGameCalendar,
  computeGameTimeFromServerRow,
  loadGameTimeForPlayer,
  loadGameTimeForFaction,
};
