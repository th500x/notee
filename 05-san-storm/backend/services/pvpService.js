/**
 * PVP 攻城挑战服务
 * 
 * 处理实时PVP对战的挑战创建、状态轮询、接受/超时逻辑
 * 
 * @module backend/services/pvpService
 */

const { pool } = require('../database/connection');

// 在线判定：最后活跃时间在5分钟内
const ONLINE_THRESHOLD_MINUTES = 5;

// 等待时间（秒）
const WAIT_IN_GAME = 10;
const WAIT_NOT_IN_GAME = 20;

/**
 * 检查城市是否有在线驻守玩家（排除攻城方自己和同势力玩家）
 * 
 * @param {string} cityId - 城市ID
 * @param {string} attackerId - 攻城方玩家ID
 * @param {string} attackerFaction - 攻城方势力ID
 * @returns {Array} 在线防守者列表（按官职排序）
 */
async function getOnlineDefenders(cityId, attackerId, attackerFaction) {
  const [rows] = await pool.query(
    `SELECT g.*, p.character_name, p.faction_id, p.position_level,
            a.lastActiveAt,
            CASE WHEN a.lastActiveAt >= DATE_SUB(NOW(), INTERVAL ? MINUTE) THEN TRUE ELSE FALSE END AS is_online
     FROM player_garrison g
     JOIN players p ON g.player_id = p.player_id
     JOIN accounts a ON g.player_id = a.id
     WHERE g.city_id = ? AND g.is_active = TRUE
       AND g.player_id != ?
       AND p.faction_id != ?
     ORDER BY p.position_level ASC, g.garrison_slot ASC`,
    [ONLINE_THRESHOLD_MINUTES, cityId, attackerId, attackerFaction]
  );

  return rows.filter(r => r.is_online);
}

/**
 * 创建 PVP 挑战
 * 
 * @param {object} params
 * @returns {object} { challengeId, waitSeconds, defenderName, ... }
 */
async function createChallenge({ warId, cityId, attackerId, attackerFaction, defenderId, defenderGarrisonSlot, defenderIsInGame }) {
  const challengeId = `pvp_${cityId}_${Date.now()}`;
  const waitSeconds = defenderIsInGame ? WAIT_IN_GAME : WAIT_NOT_IN_GAME;

  await pool.query(
    `INSERT INTO siege_challenges 
     (challenge_id, war_id, city_id, attacker_id, attacker_faction, defender_id, defender_garrison_slot, status, wait_seconds, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
    [challengeId, warId, cityId, attackerId, attackerFaction, defenderId, defenderGarrisonSlot, waitSeconds, waitSeconds]
  );

  return { challengeId, waitSeconds };
}

/**
 * 防守方轮询：检查是否有待处理的挑战
 * 
 * @param {string} playerId - 防守方玩家ID
 * @returns {object|null} 挑战信息或null
 */
async function checkPendingChallenge(playerId) {
  // 先清理过期挑战
  await pool.query(
    "UPDATE siege_challenges SET status = 'timeout' WHERE status = 'pending' AND expires_at < NOW()"
  );

  const [rows] = await pool.query(
    `SELECT sc.*, p.character_name AS attacker_name
     FROM siege_challenges sc
     JOIN players p ON sc.attacker_id = p.player_id
     WHERE sc.defender_id = ? AND sc.status = 'pending' AND sc.expires_at >= NOW()
     ORDER BY sc.created_at DESC LIMIT 1`,
    [playerId]
  );

  if (rows.length === 0) return null;

  const challenge = rows[0];
  const now = new Date();
  const expires = new Date(challenge.expires_at);
  const remainingSeconds = Math.max(0, Math.ceil((expires - now) / 1000));

  return {
    challengeId: challenge.challenge_id,
    warId: challenge.war_id,
    cityId: challenge.city_id,
    attackerId: challenge.attacker_id,
    attackerName: challenge.attacker_name,
    remainingSeconds,
    waitSeconds: challenge.wait_seconds,
  };
}

/**
 * 防守方接受挑战
 * 
 * @param {string} challengeId
 * @param {string} defenderId
 * @returns {object} { success, challenge }
 */
async function acceptChallenge(challengeId, defenderId) {
  const [rows] = await pool.query(
    "SELECT * FROM siege_challenges WHERE challenge_id = ? AND defender_id = ? AND status = 'pending'",
    [challengeId, defenderId]
  );

  if (rows.length === 0) {
    return { success: false, error: '挑战不存在或已过期' };
  }

  // 检查是否已过期
  if (new Date(rows[0].expires_at) < new Date()) {
    await pool.query("UPDATE siege_challenges SET status = 'timeout' WHERE challenge_id = ?", [challengeId]);
    return { success: false, error: '挑战已超时' };
  }

  await pool.query(
    "UPDATE siege_challenges SET status = 'accepted', accepted_at = NOW() WHERE challenge_id = ?",
    [challengeId]
  );

  return { success: true, challenge: rows[0] };
}

/**
 * 攻城方轮询：检查挑战状态
 * 
 * @param {string} challengeId
 * @returns {object} { status, remainingSeconds }
 */
async function getChallengeStatus(challengeId) {
  // 先清理过期挑战
  await pool.query(
    "UPDATE siege_challenges SET status = 'timeout' WHERE challenge_id = ? AND status = 'pending' AND expires_at < NOW()",
    [challengeId]
  );

  const [rows] = await pool.query(
    'SELECT * FROM siege_challenges WHERE challenge_id = ?',
    [challengeId]
  );

  if (rows.length === 0) return null;

  const challenge = rows[0];
  const now = new Date();
  const expires = new Date(challenge.expires_at);
  const remainingSeconds = Math.max(0, Math.ceil((expires - now) / 1000));

  return {
    challengeId: challenge.challenge_id,
    status: challenge.status,
    remainingSeconds,
    defenderId: challenge.defender_id,
    defenderGarrisonSlot: challenge.defender_garrison_slot,
  };
}

/**
 * 标记挑战完成
 */
async function completeChallenge(challengeId, result) {
  await pool.query(
    "UPDATE siege_challenges SET status = 'completed', completed_at = NOW(), result = ? WHERE challenge_id = ?",
    [result, challengeId]
  );
}

module.exports = {
  getOnlineDefenders,
  createChallenge,
  checkPendingChallenge,
  acceptChallenge,
  getChallengeStatus,
  completeChallenge,
  WAIT_IN_GAME,
  WAIT_NOT_IN_GAME,
  ONLINE_THRESHOLD_MINUTES,
};
