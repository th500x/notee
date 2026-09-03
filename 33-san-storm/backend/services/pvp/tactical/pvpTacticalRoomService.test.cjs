/**
 * pvpTacticalRoomService 状态机单测（无 DB、无推演）。
 *
 * 通过 require.cache 注入内存版 `database/connection` 与 `garrisonService`，
 * 仅模拟本服务实际发出的 SQL（INSERT/SELECT/UPDATE pvp_tactical_rooms、SELECT players）。
 * 覆盖：createRoom(invited)、自邀拒绝、accept happy(both_ready 写快照+seed)、
 *       accept 越权(403)、accept 非 invited(409)、cancel(invited→cancelled)、cancel 非 invited(409)。
 *
 * 运行：node backend/services/pvp/tactical/pvpTacticalRoomService.test.cjs
 */
const assert = require('assert');
const path = require('path');
const Module = require('module');

// ── 内存「DB」 ────────────────────────────────────────────────────────────────
const players = new Set(['A001', 'B002', 'C003']);
const rooms = new Map();

function nowPlus(sec) { return new Date(Date.now() + sec * 1000); }

/** 极简 SQL 解释器：仅识别本服务用到的语句 */
function runSql(sql, params = []) {
  const s = String(sql).replace(/\s+/g, ' ').trim();

  if (s.startsWith('SELECT player_id FROM players WHERE player_id IN')) {
    return [params.filter((p) => players.has(p)).map((p) => ({ player_id: p }))];
  }
  if (s.startsWith('INSERT INTO pvp_tactical_rooms')) {
    const [room_id, season, a, b, attacker, mapId, ttl] = params;
    rooms.set(room_id, {
      room_id, season, player_a_id: a, player_b_id: b, canonical_attacker_id: attacker,
      duel_map_id: mapId, map_seed: null, lineup_snapshot_json: null, battle_seed: null,
      event_seq: 0, status: 'invited', winner_player_id: null, winner_side: null,
      battle_id_a: null, battle_id_b: null,
      player_a_last_event_poll_at: null, player_b_last_event_poll_at: null,
      cancel_reason: null, created_at: new Date(), accepted_at: null, sim_started_at: null,
      resolved_at: null, expires_at: nowPlus(Number(ttl) || 120), updated_at: new Date(),
    });
    return [{ affectedRows: 1 }];
  }
  if (s.startsWith('SELECT * FROM pvp_tactical_rooms WHERE room_id')) {
    const roomId = params[0];
    const row = rooms.get(roomId);
    return [row ? [{ ...row }] : []];
  }
  if (s.startsWith('UPDATE pvp_tactical_rooms SET')) {
    const roomId = params[params.length - 1];
    const row = rooms.get(roomId);
    if (!row) return [{ affectedRows: 0 }];
    if (s.includes("status='both_ready'")) {
      row.status = 'both_ready';
      row.lineup_snapshot_json = params[0];
      row.battle_seed = params[1];
      row.accepted_at = new Date();
    } else if (s.includes("status='cancelled'")) {
      row.status = 'cancelled';
      row.cancel_reason = s.includes('cancel_reason = ?') ? params[0] : 'timeout';
    }
    return [{ affectedRows: 1 }];
  }
  throw new Error(`未识别 SQL: ${s}`);
}

const fakeConnection = {
  pool: { query: async (sql, params) => runSql(sql, params) },
  transaction: async (cb) => cb({ query: async (sql, params) => runSql(sql, params) }),
};

const fakeGarrison = {
  validateMainLineupBattleGateOnConn: async () => ({ ok: true, foodNeed: 0 }),
  deductMainLineupBattleFoodDeployCostOnConn: async () => 0,
  buildDefenseUnitsFromMainLineup: async (pid) => [{ _troopInstanceId: `${pid}_t1` }],
  mapBuiltUnitsToSiegeNpcFormat: (units) => units.map((u, i) => ({
    index: i, troopName: `兵${i}`, attack: 600, defense: 500, speed: 50, movement: 3,
    attackRange: 1, maxTroops: 1000, currentTroops: 1000, troopType: 'infantry',
    weaponType: 'infantry_saber', character: { name: '将', courtesyName: '将' },
    _troopInstanceId: u._troopInstanceId,
  })),
};

function inject(relFromHere, exports) {
  const abs = require.resolve(path.resolve(__dirname, relFromHere));
  const m = new Module(abs, null);
  m.filename = abs;
  m.loaded = true;
  m.exports = exports;
  require.cache[abs] = m;
}

inject('../../../database/connection.js', fakeConnection);
inject('../../garrisonService.js', fakeGarrison);

const svc = require('./pvpTacticalRoomService');

(async () => {
  // 自邀拒绝
  await assert.rejects(
    () => svc.createRoom({ inviterId: 'A001', opponentId: 'A001' }),
    (e) => e.code === 'SELF_INVITE',
    '自邀应拒绝',
  );

  // 不存在玩家
  await assert.rejects(
    () => svc.createRoom({ inviterId: 'A001', opponentId: 'ZZZZ' }),
    (e) => e.code === 'PLAYER_NOT_FOUND',
    '无效对手应拒绝',
  );

  // createRoom → invited
  const room = await svc.createRoom({ inviterId: 'A001', opponentId: 'B002' });
  assert.strictEqual(room.status, 'invited', '创建后 invited');
  assert.strictEqual(room.playerAId, 'A001');
  assert.strictEqual(room.playerBId, 'B002');
  assert.strictEqual(room.canonicalAttackerId, 'A001', 'canonical 攻方=邀战方');
  assert.ok(room.duelMapId, '应分配对决地图');

  // accept 越权（非 player_b）
  await assert.rejects(
    () => svc.acceptRoom({ roomId: room.roomId, playerId: 'C003' }),
    (e) => e.code === 'FORBIDDEN',
    '仅 player_b 可应战',
  );

  // accept happy → both_ready + 快照 + seed
  const accepted = await svc.acceptRoom({ roomId: room.roomId, playerId: 'B002' });
  assert.strictEqual(accepted.status, 'both_ready', 'accept 后 both_ready');
  assert.ok(accepted.lineupSnapshots && Array.isArray(accepted.lineupSnapshots.a) && accepted.lineupSnapshots.a.length > 0, '快照 a 冻结');
  assert.ok(Array.isArray(accepted.lineupSnapshots.b) && accepted.lineupSnapshots.b.length > 0, '快照 b 冻结');
  assert.ok(Number.isFinite(Number(accepted.battleSeed)), 'battle_seed 已写入');

  // 重复 accept（非 invited）→ 409
  await assert.rejects(
    () => svc.acceptRoom({ roomId: room.roomId, playerId: 'B002' }),
    (e) => e.code === 'INVALID_STATE',
    'both_ready 再 accept → INVALID_STATE',
  );

  // 确定性 battle_seed：同 room/玩家组合 hashSeed 稳定
  const reread = await svc.getRoom(room.roomId);
  assert.strictEqual(String(reread.battleSeed), String(accepted.battleSeed), 'battle_seed 持久一致');

  // cancel：both_ready 不可取消
  await assert.rejects(
    () => svc.cancelRoom({ roomId: room.roomId, playerId: 'A001' }),
    (e) => e.code === 'INVALID_STATE',
    'both_ready 不可取消',
  );

  // 新房间 → cancel(invited) → cancelled
  const room2 = await svc.createRoom({ inviterId: 'A001', opponentId: 'B002' });
  const cancelled = await svc.cancelRoom({ roomId: room2.roomId, playerId: 'A001', reason: 'withdraw' });
  assert.strictEqual(cancelled.status, 'cancelled', 'invited 可取消');
  assert.strictEqual(cancelled.cancelReason, 'withdraw', '取消原因记录');

  // 非参与者取消 → 403
  const room3 = await svc.createRoom({ inviterId: 'A001', opponentId: 'B002' });
  await assert.rejects(
    () => svc.cancelRoom({ roomId: room3.roomId, playerId: 'C003' }),
    (e) => e.code === 'FORBIDDEN',
    '非参与者不可取消',
  );

  console.log('pvpTacticalRoomService.test.cjs: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
