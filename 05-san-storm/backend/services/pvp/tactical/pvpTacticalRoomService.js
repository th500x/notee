/**
 * PVP 战术对决 · 房间状态机服务（17-5-DUEL_SYSTEM §12.3 / §12.7；17-5-2 步骤 2）
 *
 * 职责（**不跑推演**，推演见 `pvpTacticalSimRunner.js` 步骤 5）：
 *   - 邀战 / 应战 / 取消 状态机：invited → both_ready →（sim_running → resolved）/ cancelled。
 *   - accept 时复用 `validateMainLineupBattleGateOnConn` 门闸（≥兵力 + 粮草）并扣粮，
 *     冻结双方 `main_lineup` 快照（`mapBuiltUnitsToSiegeNpcFormat`，与披挂自动对决同源、与 `runPvpTacticalDuel` 入参兼容）。
 *   - 行锁：房间转移在事务内 `SELECT … FOR UPDATE`，多实例安全（取代单进程 pvpService 内存）。
 *   - `battle_seed = hashSeed([room_id, player_a, player_b])` 写入。
 *   - canonical：side a = player_a（邀战方），side b = player_b（应战方）。
 *
 * 错误：抛 Error 并附 `.code` 与 `.httpStatus`，由路由层映射 HTTP（13-pvp-tactical-api，步骤 6）。
 *
 * @see docs/10-core-system/17-5-DUEL_SYSTEM.md §12.3 §12.7 §12.9
 * @see docs/10-core-system/17-5-2-TACTICAL_AUTO_DUEL_IMPLEMENTATION.md 步骤 2
 */

const { pool, transaction } = require('../../../database/connection');
const garrisonService = require('../../garrisonService');
const { hashSeed } = require('../auto-duel/pvpAutoDuelSim');
const { newShortBattleId } = require('../../../utils/battleId');

const STATUS = Object.freeze({
  INVITED: 'invited',
  BOTH_READY: 'both_ready',
  SIM_RUNNING: 'sim_running',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled',
});

/** 邀战默认有效期（秒）；invited 阶段倒计时，与披挂 ~10s/道路遇袭口径可后调 */
const DEFAULT_INVITE_TTL_SEC = 120;

function fail(code, message, httpStatus = 409) {
  const err = new Error(message || code);
  err.code = code;
  err.httpStatus = httpStatus;
  return err;
}

/** 对决地图池缓存（ESM catalog 动态加载一次） */
let _poolIdsPromise = null;
async function getDuelMapPoolIds() {
  if (!_poolIdsPromise) {
    _poolIdsPromise = import('../../../../shared/utils/pvpDuelMapCatalog.js').then((m) => {
      const ids = (m.DUEL_MAP_POOL_IDS && m.DUEL_MAP_POOL_IDS.length)
        ? m.DUEL_MAP_POOL_IDS
        : m.DUEL_MAP_PRESET_IDS;
      return Array.isArray(ids) && ids.length ? ids : ['duel_map_dev_flat'];
    });
  }
  return _poolIdsPromise;
}

/** 从对决地图池随机选 1 张（§12.2：不写死每 profile 张数） */
async function pickDuelMapId(explicit) {
  const ids = await getDuelMapPoolIds();
  if (explicit && ids.includes(explicit)) return explicit;
  if (explicit) return explicit; // 允许传入池外 id（如 dev_flat 联调），由内核校验
  return ids[Math.floor(Math.random() * ids.length)];
}

/**
 * 按 seed 确定性选图（真实链条披挂①/道路②用）：同 seed → 同图，
 * 使整场对决「仅凭 battleSeed + 双方快照」即可复现（房间另存 duel_map_id 兜底）。
 * @param {number} seed
 * @returns {Promise<string>}
 */
async function pickDuelMapIdForSeed(seed) {
  const ids = await getDuelMapPoolIds();
  const n = ids.length;
  if (!n) return 'duel_map_dev_flat';
  return ids[(Number(seed) >>> 0) % n];
}

/** 构建某玩家 main_lineup 冻结快照（与披挂自动对决同源、与 runPvpTacticalDuel 入参兼容） */
async function buildLineupSnapshotForPlayer(playerId) {
  const raw = await garrisonService.buildDefenseUnitsFromMainLineup(playerId);
  return garrisonService.mapBuiltUnitsToSiegeNpcFormat(raw);
}

function rowToRoom(row) {
  if (!row) return null;
  let snapshot = null;
  if (row.lineup_snapshot_json) {
    try { snapshot = JSON.parse(row.lineup_snapshot_json); } catch { snapshot = null; }
  }
  return {
    roomId: row.room_id,
    season: row.season ?? null,
    playerAId: row.player_a_id,
    playerBId: row.player_b_id,
    canonicalAttackerId: row.canonical_attacker_id,
    duelMapId: row.duel_map_id ?? null,
    mapSeed: row.map_seed ?? null,
    lineupSnapshots: snapshot,
    battleSeed: row.battle_seed ?? null,
    eventSeq: row.event_seq ?? 0,
    status: row.status,
    winnerPlayerId: row.winner_player_id ?? null,
    winnerSide: row.winner_side ?? null,
    battleIdA: row.battle_id_a ?? null,
    battleIdB: row.battle_id_b ?? null,
    playerALastEventPollAt: row.player_a_last_event_poll_at ?? null,
    playerBLastEventPollAt: row.player_b_last_event_poll_at ?? null,
    cancelReason: row.cancel_reason ?? null,
    createdAt: row.created_at ?? null,
    acceptedAt: row.accepted_at ?? null,
    simStartedAt: row.sim_started_at ?? null,
    resolvedAt: row.resolved_at ?? null,
    expiresAt: row.expires_at ?? null,
  };
}

async function getRoomRow(conn, roomId, forUpdate = false) {
  const [rows] = await conn.query(
    `SELECT * FROM pvp_tactical_rooms WHERE room_id = ?${forUpdate ? ' FOR UPDATE' : ''}`,
    [roomId],
  );
  return rows[0] || null;
}

/**
 * 创建邀战（status=invited）。仅校验邀战方门闸（快照在 accept 冻结）。
 * @param {{ inviterId: string, opponentId: string, duelMapId?: string, season?: string, inviteTtlSec?: number }} params
 * @returns {Promise<object>} room
 */
async function createRoom(params) {
  const { inviterId, opponentId, duelMapId, season = null, inviteTtlSec = DEFAULT_INVITE_TTL_SEC } = params || {};
  if (!inviterId || !opponentId) throw fail('BAD_REQUEST', '缺少邀战双方 player_id', 400);
  if (inviterId === opponentId) throw fail('SELF_INVITE', '不能向自己发起对决', 400);

  const [pRows] = await pool.query(
    'SELECT player_id FROM players WHERE player_id IN (?, ?)',
    [inviterId, opponentId],
  );
  const found = new Set(pRows.map((r) => r.player_id));
  if (!found.has(inviterId) || !found.has(opponentId)) {
    throw fail('PLAYER_NOT_FOUND', '对阵双方需均为有效玩家', 404);
  }

  const mapId = await pickDuelMapId(duelMapId);
  const roomId = newShortBattleId('ptr');
  const ttl = Math.max(10, Math.floor(Number(inviteTtlSec) || DEFAULT_INVITE_TTL_SEC));

  // 邀战方门闸快速失败（不扣粮、不冻快照）
  await transaction(async (conn) => {
    const gate = await garrisonService.validateMainLineupBattleGateOnConn(conn, inviterId);
    if (!gate.ok) throw fail('BATTLE_GATE_FAILED', `邀战方不满足出战条件：${gate.error}`, 422);
  });

  await pool.query(
    `INSERT INTO pvp_tactical_rooms
       (room_id, season, player_a_id, player_b_id, canonical_attacker_id, duel_map_id, status, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, '${STATUS.INVITED}', DATE_ADD(NOW(), INTERVAL ? SECOND))`,
    [roomId, season, inviterId, opponentId, inviterId, mapId, ttl],
  );

  return getRoom(roomId);
}

/**
 * 应战（仅 player_b）：双方门闸 + 扣粮 + 冻结快照 + battle_seed → both_ready。
 * @param {{ roomId: string, playerId: string }} params
 * @returns {Promise<object>} room（both_ready）
 */
async function acceptRoom(params) {
  const { roomId, playerId } = params || {};
  if (!roomId || !playerId) throw fail('BAD_REQUEST', '缺少 roomId / playerId', 400);

  return transaction(async (conn) => {
    const row = await getRoomRow(conn, roomId, true);
    if (!row) throw fail('ROOM_NOT_FOUND', '房间不存在', 404);
    if (row.player_b_id !== playerId) throw fail('FORBIDDEN', '仅被邀战方可应战', 403);
    if (row.status !== STATUS.INVITED) {
      throw fail('INVALID_STATE', `房间状态 ${row.status} 不可应战`, 409);
    }
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      await conn.query(
        `UPDATE pvp_tactical_rooms SET status='${STATUS.CANCELLED}', cancel_reason='timeout' WHERE room_id = ?`,
        [roomId],
      );
      throw fail('INVITE_EXPIRED', '邀战已超时', 409);
    }

    const aId = row.player_a_id;
    const bId = row.player_b_id;

    // 门闸（FOR UPDATE players 行）+ 扣粮（同口径，须 accept 即提交，both_ready 必推演）
    const gateA = await garrisonService.validateMainLineupBattleGateOnConn(conn, aId);
    if (!gateA.ok) throw fail('BATTLE_GATE_FAILED', `邀战方不满足出战条件：${gateA.error}`, 422);
    const gateB = await garrisonService.validateMainLineupBattleGateOnConn(conn, bId);
    if (!gateB.ok) throw fail('BATTLE_GATE_FAILED', `应战方不满足出战条件：${gateB.error}`, 422);
    await garrisonService.deductMainLineupBattleFoodDeployCostOnConn(conn, aId, { foodNeed: gateA.foodNeed });
    await garrisonService.deductMainLineupBattleFoodDeployCostOnConn(conn, bId, { foodNeed: gateB.foodNeed });

    const [snapA, snapB] = await Promise.all([
      buildLineupSnapshotForPlayer(aId),
      buildLineupSnapshotForPlayer(bId),
    ]);
    const lineupSnapshots = { a: snapA, b: snapB };
    const battleSeed = hashSeed([roomId, aId, bId]);

    await conn.query(
      `UPDATE pvp_tactical_rooms
         SET status='${STATUS.BOTH_READY}',
             lineup_snapshot_json = ?,
             battle_seed = ?,
             accepted_at = NOW()
       WHERE room_id = ?`,
      [JSON.stringify(lineupSnapshots), battleSeed, roomId],
    );

    const updated = await getRoomRow(conn, roomId, false);
    return rowToRoom(updated);
  });
}

/**
 * 取消邀战（仅 invited 阶段；both_ready 后已承诺出战，自动推演不可撤）。
 * @param {{ roomId: string, playerId: string, reason?: string }} params
 */
async function cancelRoom(params) {
  const { roomId, playerId, reason = 'withdraw' } = params || {};
  if (!roomId || !playerId) throw fail('BAD_REQUEST', '缺少 roomId / playerId', 400);
  return transaction(async (conn) => {
    const row = await getRoomRow(conn, roomId, true);
    if (!row) throw fail('ROOM_NOT_FOUND', '房间不存在', 404);
    if (row.player_a_id !== playerId && row.player_b_id !== playerId) {
      throw fail('FORBIDDEN', '非房间参与者', 403);
    }
    if (row.status !== STATUS.INVITED) {
      throw fail('INVALID_STATE', `房间状态 ${row.status} 不可取消`, 409);
    }
    await conn.query(
      `UPDATE pvp_tactical_rooms SET status='${STATUS.CANCELLED}', cancel_reason = ? WHERE room_id = ?`,
      [String(reason).slice(0, 64), roomId],
    );
    const updated = await getRoomRow(conn, roomId, false);
    return rowToRoom(updated);
  });
}

/** 读取房间（含解析后的快照） */
async function getRoom(roomId) {
  const row = await getRoomRow(pool, roomId, false);
  return rowToRoom(row);
}

/** 记录某参与者最近拉取 events / heartbeat 时间（在线判定，§12.7） */
async function markEventPoll(params) {
  const { roomId, playerId } = params || {};
  if (!roomId || !playerId) return false;
  const row = await getRoomRow(pool, roomId, false);
  if (!row) return false;
  let col = null;
  if (row.player_a_id === playerId) col = 'player_a_last_event_poll_at';
  else if (row.player_b_id === playerId) col = 'player_b_last_event_poll_at';
  if (!col) return false;
  await pool.query(`UPDATE pvp_tactical_rooms SET ${col} = NOW() WHERE room_id = ?`, [roomId]);
  return true;
}

/** 某玩家待应战列表（player_b 视角、invited 未过期） */
async function listPendingForPlayer(playerId) {
  if (!playerId) return [];
  const [rows] = await pool.query(
    `SELECT * FROM pvp_tactical_rooms
      WHERE player_b_id = ? AND status = '${STATUS.INVITED}'
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC`,
    [playerId],
  );
  return rows.map(rowToRoom);
}

module.exports = {
  STATUS,
  DEFAULT_INVITE_TTL_SEC,
  createRoom,
  acceptRoom,
  cancelRoom,
  getRoom,
  markEventPoll,
  listPendingForPlayer,
  // 供步骤 5 runner 与测试复用
  pickDuelMapId,
  pickDuelMapIdForSeed,
  buildLineupSnapshotForPlayer,
  _rowToRoom: rowToRoom,
};
