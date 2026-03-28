/**
 * PVP 攻城挑战服务（内存方案）
 * 
 * 挑战生命周期只有 10-20 秒，不需要持久化到数据库。
 * 使用进程内 Map 存储，自动过期清理。
 * 
 * @module backend/services/pvpService
 */

const { pool } = require('../database/connection');

// ── 配置 ──
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;  // 5分钟内活跃 = 在线
const WAIT_IN_GAME = 10;    // 防守方在游戏内：10秒
const WAIT_NOT_IN_GAME = 20; // 防守方不在游戏内：20秒

// ── 内存存储 ──
// key: challengeId, value: challenge 对象
const challenges = new Map();
// key: defenderId, value: challengeId（快速查找防守方的待处理挑战）
const defenderIndex = new Map();

/**
 * 自动清理过期挑战
 */
function cleanExpired() {
  const now = Date.now();
  for (const [id, c] of challenges) {
    if (c.expiresAt <= now && c.status === 'pending') {
      c.status = 'timeout';
      defenderIndex.delete(c.defenderId);
    }
    // 完成/超时的挑战保留60秒后彻底删除（给轮询一个缓冲）
    if (c.status !== 'pending' && now - c.expiresAt > 60000) {
      challenges.delete(id);
    }
  }
}

// 每5秒清理一次
setInterval(cleanExpired, 5000);

/**
 * 检查城市是否有在线驻守玩家
 */
async function getOnlineDefenders(cityId, attackerId, attackerFaction) {
  const [rows] = await pool.query(
    `SELECT g.player_id, g.garrison_slot, p.character_name, p.position_level, a.lastActiveAt
     FROM player_garrison g
     JOIN players p ON g.player_id = p.player_id
     JOIN accounts a ON g.player_id = a.id
     WHERE g.city_id = ? AND g.is_active = TRUE
       AND g.player_id != ? AND p.faction_id != ?
     ORDER BY p.position_level ASC, g.garrison_slot ASC`,
    [cityId, attackerId, attackerFaction]
  );

  const now = Date.now();
  return rows.filter(r => now - new Date(r.lastActiveAt).getTime() < ONLINE_THRESHOLD_MS);
}

/**
 * 创建 PVP 挑战
 */
function createChallenge({ warId, cityId, attackerId, attackerFaction, defenderId, defenderGarrisonSlot, defenderIsInGame }) {
  // 清理该防守方之前的未完成挑战
  const oldId = defenderIndex.get(defenderId);
  if (oldId) {
    const old = challenges.get(oldId);
    if (old && old.status === 'pending') old.status = 'timeout';
    challenges.delete(oldId);
    defenderIndex.delete(defenderId);
  }

  const challengeId = `pvp_${cityId}_${Date.now()}`;
  const waitSeconds = defenderIsInGame ? WAIT_IN_GAME : WAIT_NOT_IN_GAME;
  const now = Date.now();

  const challenge = {
    challengeId,
    warId,
    cityId,
    attackerId,
    attackerFaction,
    defenderId,
    defenderGarrisonSlot,
    status: 'pending',       // pending → accepted / timeout / completed
    waitSeconds,
    createdAt: now,
    expiresAt: now + waitSeconds * 1000,
    acceptedAt: null,
    result: null,
  };

  challenges.set(challengeId, challenge);
  defenderIndex.set(defenderId, challengeId);

  return { challengeId, waitSeconds };
}

/**
 * 防守方轮询：检查是否有待处理的挑战
 */
async function checkPendingChallenge(defenderId) {
  const challengeId = defenderIndex.get(defenderId);
  if (!challengeId) return null;

  const c = challenges.get(challengeId);
  if (!c || c.status !== 'pending') {
    defenderIndex.delete(defenderId);
    return null;
  }

  // 检查是否过期
  const now = Date.now();
  if (now >= c.expiresAt) {
    c.status = 'timeout';
    defenderIndex.delete(defenderId);
    return null;
  }

  // 查攻城方角色名
  const [rows] = await pool.query('SELECT character_name FROM players WHERE player_id = ?', [c.attackerId]);
  const attackerName = rows[0]?.character_name || c.attackerId;

  return {
    challengeId: c.challengeId,
    warId: c.warId,
    cityId: c.cityId,
    attackerId: c.attackerId,
    attackerName,
    remainingSeconds: Math.max(0, Math.ceil((c.expiresAt - now) / 1000)),
    waitSeconds: c.waitSeconds,
  };
}

/**
 * 防守方接受挑战
 */
function acceptChallenge(challengeId, defenderId) {
  const c = challenges.get(challengeId);
  if (!c || c.defenderId !== defenderId) {
    return { success: false, error: '挑战不存在' };
  }
  if (c.status !== 'pending') {
    return { success: false, error: c.status === 'timeout' ? '挑战已超时' : '挑战状态异常' };
  }
  if (Date.now() >= c.expiresAt) {
    c.status = 'timeout';
    defenderIndex.delete(defenderId);
    return { success: false, error: '挑战已超时' };
  }

  c.status = 'accepted';
  c.acceptedAt = Date.now();
  defenderIndex.delete(defenderId);

  return { success: true };
}

/**
 * 攻城方轮询：检查挑战状态
 */
function getChallengeStatus(challengeId) {
  const c = challenges.get(challengeId);
  if (!c) return null;

  // 检查过期
  if (c.status === 'pending' && Date.now() >= c.expiresAt) {
    c.status = 'timeout';
    defenderIndex.delete(c.defenderId);
  }

  return {
    challengeId: c.challengeId,
    status: c.status,
    remainingSeconds: Math.max(0, Math.ceil((c.expiresAt - Date.now()) / 1000)),
    defenderId: c.defenderId,
    defenderGarrisonSlot: c.defenderGarrisonSlot,
  };
}

/**
 * 标记挑战完成
 */
function completeChallenge(challengeId, result) {
  const c = challenges.get(challengeId);
  if (c) {
    c.status = 'completed';
    c.result = result;
    defenderIndex.delete(c.defenderId);
  }
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
};
