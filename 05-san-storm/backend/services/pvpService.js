/**
 * PVP 攻城挑战服务（内存方案）
 * 
 * 挑战生命周期约 10 秒（遇袭通知窗口），不需要持久化到数据库。
 * 使用进程内 Map 存储，自动过期清理。
 * 
 * @module backend/services/pvpService
 */

const { pool } = require('../database/connection');
const { ts } = require('../utils/playerActivity');
const garrisonService = require('./garrisonService');

// ── 配置 ──
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;  // 5分钟内活跃 = 在线
// 与产品设计一致：遇袭通知统一 10 秒窗口（见 13-2 披挂遇袭）
const WAIT_IN_GAME = 10;
const WAIT_NOT_IN_GAME = 10;

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
 * 检查城市是否有「有效驻地守军」且在线的玩家（遇袭通知等）。
 * 与攻城相同：仅 **当前** 整编兵力 ≥ `MIN_GARRISON_TOTAL_TROOPS` 的驻地槽参与，不能仅靠 `is_active`。
 */
async function getOnlineDefenders(cityId, attackerId, attackerFaction) {
  const [rows] = await pool.query(
    `SELECT g.*, p.character_name, p.position_level,
            p.last_active_at AS playerActive, a.lastActiveAt AS accountActive
     FROM player_garrison g
     JOIN players p ON g.player_id = p.player_id
     JOIN accounts a ON g.player_id = a.id
     JOIN cities c ON c.city_id = g.city_id
     WHERE g.city_id = ? AND g.is_active = TRUE
       AND g.player_id != ? AND p.faction_id != ?
       AND c.faction_id IS NOT NULL AND p.faction_id = c.faction_id
     ORDER BY p.position_level ASC, g.garrison_slot ASC`,
    [cityId, attackerId, attackerFaction]
  );

  const troopOk = await garrisonService.filterCityDefenseRowsByMinStationedTroop(rows);

  const now = Date.now();
  return troopOk.filter((r) => {
    const lastSeen = Math.max(ts(r.playerActive), ts(r.accountActive));
    return lastSeen && now - lastSeen < ONLINE_THRESHOLD_MS;
  });
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
  // 服务端已裁定（攻城方 countdown 到期）后仍会尝试 accept → 不再报「异常」，便于兼容旧客户端
  if (c.status === 'completed' && c.siegeOutcome) {
    return { success: true, alreadyCompleted: true };
  }
  if (c.status === 'accepted') {
    return { success: true, alreadyAccepted: true };
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

/**
 * 防守方接受挑战后：拉取攻城方上阵部队（作敌方单位）与城市信息，用于进入战斗 UI
 */
async function getDefenderBattleContext(challengeId, defenderId) {
  cleanExpired();
  const c = challenges.get(challengeId);
  if (!c || c.defenderId !== defenderId) {
    return { ok: false, error: '挑战不存在' };
  }
  if (c.status !== 'accepted') {
    return { ok: false, error: '请先接受挑战或挑战已失效' };
  }

  const garrisonService = require('./garrisonService');
  const [cityRows] = await pool.query('SELECT city_name FROM cities WHERE city_id = ?', [c.cityId]);
  const cityName = cityRows[0]?.city_name || c.cityId;

  const [nameRows] = await pool.query(
    'SELECT player_id, character_name FROM players WHERE player_id IN (?, ?)',
    [c.attackerId, c.defenderId]
  );
  const nameMap = Object.fromEntries(nameRows.map((r) => [r.player_id, r.character_name]));

  const rawAttackerUnits = await garrisonService.buildDefenseUnitsFromMainLineup(c.attackerId);
  const npcGarrison = garrisonService.mapBuiltUnitsToSiegeNpcFormat(rawAttackerUnits);

  return {
    ok: true,
    warId: c.warId,
    cityId: c.cityId,
    cityName,
    attackerFaction: c.attackerFaction,
    attackerId: c.attackerId,
    attackerName: nameMap[c.attackerId] || c.attackerId,
    defenderName: nameMap[c.defenderId] || c.defenderId,
    npcGarrison,
    npcAlive: npcGarrison.length,
    npcTotal: npcGarrison.length,
    defenderGarrisonSlot: c.defenderGarrisonSlot,
  };
}

/**
 * 取挑战（内部/路由校验用，勿向前端暴露敏感字段以外的用途）
 * @param {string} challengeId
 */
function peekChallenge(challengeId) {
  return challenges.get(challengeId) || null;
}

/**
 * 披挂攻城：服务端权威结算完成后挂载结果，供防守方轮询
 * @param {string} challengeId
 * @param {object} payload resolveAuthoritativeSiegePvp 产出
 */
function markSiegeResolved(challengeId, payload) {
  const c = challenges.get(challengeId);
  if (!c) return false;
  c.siegeOutcome = payload;
  c.siegeResolved = true;
  c.status = 'completed';
  defenderIndex.delete(c.defenderId);
  return true;
}

/**
 * @returns {object|null}
 */
function getSiegeOutcome(challengeId) {
  const c = challenges.get(challengeId);
  if (!c || !c.siegeOutcome) return null;
  return { ...c.siegeOutcome, challengeId };
}

module.exports = {
  getOnlineDefenders,
  createChallenge,
  checkPendingChallenge,
  acceptChallenge,
  getChallengeStatus,
  getDefenderBattleContext,
  completeChallenge,
  peekChallenge,
  markSiegeResolved,
  getSiegeOutcome,
  WAIT_IN_GAME,
  WAIT_NOT_IN_GAME,
};
