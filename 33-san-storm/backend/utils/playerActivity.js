/**
 * 玩家「当前是否算在游戏内」判定
 *
 * 登录会更新 accounts.lastActiveAt；拉取档案等会更新 players.last_active_at。
 * 攻城 PVP 必须用两者中较新的时间，否则会误判离线。
 */

const { pool } = require('../database/connection');

const DEFAULT_ONLINE_MS = 5 * 60 * 1000;

function ts(value) {
  if (!value) return 0;
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {string} playerId
 * @param {number} [thresholdMs]
 * @returns {Promise<boolean>}
 */
async function isPlayerRecentlyActive(playerId, thresholdMs = DEFAULT_ONLINE_MS) {
  const [rows] = await pool.query(
    `SELECT p.last_active_at AS playerActive, a.lastActiveAt AS accountActive
     FROM players p
     INNER JOIN accounts a ON p.player_id = a.id
     WHERE p.player_id = ?`,
    [playerId]
  );
  if (!rows.length) return false;
  const lastSeen = Math.max(ts(rows[0].playerActive), ts(rows[0].accountActive));
  if (!lastSeen) return false;
  return Date.now() - lastSeen < thresholdMs;
}

module.exports = {
  isPlayerRecentlyActive,
  DEFAULT_ONLINE_MS,
  ts,
};
