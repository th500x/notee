/**
 * PVP 战术对决 · 触发推演并持久化事件（17-5-DUEL_SYSTEM §12.5/§12.6；17-5-2 步骤 5）
 *
 * 职责：both_ready → sim_running → resolved。
 *   - 调用权威内核 **`runPvpTacticalDuel`**（ESM，`await import`）产出 events + finalState + battleLog。
 *   - 批量写 `pvp_tactical_room_events`（seq 连续无洞）。
 *   - 「阵前切磋」= 模拟游玩（产品决策 2026-06-03，17-5 §12）：**不**写回兵力伤亡、**不**进老兵 battle_count、
 *     不计分/奖励；战报 `saveBattle({ skipStatistics: true })` 仅落库供回看，不进 `player_statistics`。
 *   - 双方战报 `battles`（`battle_type = pvp_tactical_duel`）；`rewards.eventReplay.roomId` 指向事件表供全量 replay。
 *   - 幂等：已 `resolved` 的房间再 start → 返回既有结果；进程内 `runningPromises` 防并发重入。
 *   - 失败补偿：推演/落库失败 → 房间回 `cancelled`（cancel_reason='sim_failed'），不留半 `sim_running`。
 *
 * @see docs/01-jun-exploration/10-core-system/17-5-2-TACTICAL_AUTO_DUEL_IMPLEMENTATION.md 步骤 5
 */

const { pool, transaction } = require('../../../database/connection');
const battleService = require('../../battleService');
const { newShortBattleId } = require('../../../utils/battleId');
const roomService = require('./pvpTacticalRoomService');
const { buildDuelReportForSide, TACTICAL_DUEL_SCORE_MULT } = require('./pvpDuelReportStats');

const { STATUS } = roomService;

/** 进程内防并发重入（多实例由 DB status + FOR UPDATE 兜底） */
const runningPromises = new Map();

/** ESM 内核动态加载（缓存） */
let _kernelPromise = null;
function loadKernel() {
  if (!_kernelPromise) {
    _kernelPromise = import('../../../../shared/battle/tacticalSim/runPvpTacticalDuel.js');
  }
  return _kernelPromise;
}

function fail(code, message, httpStatus = 409) {
  const err = new Error(message || code);
  err.code = code;
  err.httpStatus = httpStatus;
  return err;
}

function teamNames(snapshot) {
  return (snapshot || []).map((n) => ({
    name: n.character?.courtesyName || n.character?.name || n.troopName,
    courtesyName: n.character?.courtesyName || n.character?.name || n.troopName,
  }));
}

/** 占用同一 roomId 的进行中结算（幂等 + 防重入） */
async function startRoom(params) {
  const { roomId } = params || {};
  if (!roomId) throw fail('BAD_REQUEST', '缺少 roomId', 400);
  if (runningPromises.has(roomId)) return runningPromises.get(roomId);
  const p = doStartRoom(roomId).finally(() => runningPromises.delete(roomId));
  runningPromises.set(roomId, p);
  return p;
}

async function doStartRoom(roomId) {
  // 1) 抢占：both_ready → sim_running（FOR UPDATE 行锁；幂等返回已 resolved）
  const claimed = await transaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM pvp_tactical_rooms WHERE room_id = ? FOR UPDATE', [roomId]);
    const row = rows[0];
    if (!row) throw fail('ROOM_NOT_FOUND', '房间不存在', 404);
    if (row.status === STATUS.RESOLVED) return { alreadyResolved: true, row };
    if (row.status === STATUS.SIM_RUNNING) throw fail('SIM_IN_PROGRESS', '推演进行中', 409);
    if (row.status !== STATUS.BOTH_READY) throw fail('INVALID_STATE', `房间状态 ${row.status} 不可推演`, 409);
    await conn.query(
      `UPDATE pvp_tactical_rooms SET status='${STATUS.SIM_RUNNING}', sim_started_at = NOW() WHERE room_id = ?`,
      [roomId],
    );
    return { alreadyResolved: false, row };
  });

  if (claimed.alreadyResolved) {
    return buildResultFromRow(claimed.row);
  }

  const row = claimed.row;
  try {
    return await resolveSim(row);
  } catch (e) {
    // 补偿：不留半 sim_running
    try {
      await pool.query(
        `UPDATE pvp_tactical_rooms SET status='${STATUS.CANCELLED}', cancel_reason='sim_failed' WHERE room_id = ?`,
        [roomId],
      );
    } catch (e2) {
      console.error('[pvpTacticalSimRunner] 补偿置 cancelled 失败', { roomId, message: e2.message });
    }
    console.error('[pvpTacticalSimRunner] 推演失败', { roomId, message: e.message });
    throw fail('SIM_FAILED', `推演失败：${e.message}`, 500);
  }
}

async function resolveSim(row) {
  const roomId = row.room_id;
  const aId = row.player_a_id;
  const bId = row.player_b_id;

  let lineupSnapshots = null;
  try { lineupSnapshots = JSON.parse(row.lineup_snapshot_json || 'null'); } catch { lineupSnapshots = null; }
  if (!lineupSnapshots || !Array.isArray(lineupSnapshots.a) || !Array.isArray(lineupSnapshots.b)) {
    throw new Error('lineup_snapshot_json 缺失或非法');
  }

  const kernel = await loadKernel();
  const sim = kernel.runPvpTacticalDuel({
    duelMapId: row.duel_map_id,
    lineupSnapshots,
    battleSeed: Number(row.battle_seed) >>> 0,
    sideLabels: { a: aId, b: bId },
  });

  const { events, winnerSide, rounds, finalState, battleLog } = sim;
  const winnerPlayerId = winnerSide === 'a' ? aId : winnerSide === 'b' ? bId : null;
  const maxSeq = events.length ? events[events.length - 1].seq : 0;

  // 2) 战报（best-effort，先于 resolve 取得 battleId 回填）
  const battleLogText = Array.isArray(battleLog) ? battleLog.join('\n') : '';
  const namesA = teamNames(lineupSnapshots.a);
  const namesB = teamNames(lineupSnapshots.b);
  const resultA = winnerSide === 'a' ? 'win' : winnerSide === 'b' ? 'lose' : 'draw';
  const resultB = winnerSide === 'b' ? 'win' : winnerSide === 'a' ? 'lose' : 'draw';

  // 单方视角战报数值（按方歼敌/自损兵力 + 歼灭单位数 + 评分；评分仅展示，见 §9 备注）
  const reportA = buildDuelReportForSide({
    finalState, lineupSnapshots, playerSide: 'a', rounds, result: resultA, scoreMultiplier: TACTICAL_DUEL_SCORE_MULT,
  });
  const reportB = buildDuelReportForSide({
    finalState, lineupSnapshots, playerSide: 'b', rounds, result: resultB, scoreMultiplier: TACTICAL_DUEL_SCORE_MULT,
  });

  const battleIdA = newShortBattleId('pvp_td_a');
  const battleIdB = newShortBattleId('pvp_td_b');
  const baseRewards = {
    authoritative: true,
    battleSeed: Number(row.battle_seed) >>> 0,
    roomId,
    duelMapId: row.duel_map_id,
    eventReplay: { source: 'pvp_tactical_room_events', roomId, maxSeq },
  };
  // 产品决策（2026-06-03）：友谊「阵前切磋」= 模拟游玩，**不**计入活动排行 player_statistics.total_battle_score。
  //   battleScore/grade 仅落 rewards 供战报「完整计分步骤」展示（18-1 §5），不调用 applyBattleScore。
  const rewardsFor = (report) => ({
    ...baseRewards,
    battleScore: report.score.score,
    battleGrade: report.score.grade, // 与披挂/道路/PVE 统一字段名（战报列表/纪念图读 battleGrade）
    scoreDetails: report.score.details,
  });
  // 「阵前切磋」= 模拟游玩：战报仅供回看，skipStatistics 不计战绩/伤害/击杀（不进 player_statistics）。
  await saveBattleSafe({
    battleId: battleIdA, playerId: aId, battleType: 'pvp_tactical_duel', opponentType: 'player',
    opponentId: bId, opponentName: bId, result: resultA,
    playerTeam: namesA, opponentTeam: namesB, battleLog: battleLogText,
    totalDamageDealt: reportA.totalDamageDealt, totalDamageTaken: reportA.totalDamageTaken,
    totalKills: reportA.totalKills, duration: rounds, rewards: rewardsFor(reportA),
  }, { skipStatistics: true });
  await saveBattleSafe({
    battleId: battleIdB, playerId: bId, battleType: 'pvp_tactical_duel', opponentType: 'player',
    opponentId: aId, opponentName: aId, result: resultB,
    playerTeam: namesB, opponentTeam: namesA, battleLog: battleLogText,
    totalDamageDealt: reportB.totalDamageDealt, totalDamageTaken: reportB.totalDamageTaken,
    totalKills: reportB.totalKills, duration: rounds, rewards: rewardsFor(reportB),
  }, { skipStatistics: true });

  // 3) 事件落库 + 房间 resolved（同一事务：seq 连续无洞、状态原子）
  await transaction(async (conn) => {
    if (events.length) {
      const values = [];
      const placeholders = [];
      for (const ev of events) {
        placeholders.push('(?, ?, ?, ?)');
        values.push(roomId, ev.seq, ev.type, JSON.stringify(ev.payload ?? null));
      }
      await conn.query(
        `INSERT INTO pvp_tactical_room_events (room_id, seq, type, payload_json) VALUES ${placeholders.join(', ')}`,
        values,
      );
    }
    await conn.query(
      `UPDATE pvp_tactical_rooms
         SET status='${STATUS.RESOLVED}',
             event_seq = ?, winner_side = ?, winner_player_id = ?,
             battle_id_a = ?, battle_id_b = ?, resolved_at = NOW()
       WHERE room_id = ?`,
      [maxSeq, winnerSide, winnerPlayerId, battleIdA, battleIdB, roomId],
    );
  });

  // 注：「阵前切磋」= 模拟游玩（产品决策 2026-06-03，17-5 §12）：**不**写回 player_cards 兵力伤亡、
  //     **不**进老兵 battle_count、不计分/奖励。如未来需真实兵力成本，再在此接 casualties 写回（拆离 battle_count）。

  return {
    roomId,
    status: STATUS.RESOLVED,
    winnerSide,
    winnerPlayerId,
    rounds,
    eventSeq: maxSeq,
    battleIdA,
    battleIdB,
    finalState,
  };
}

async function saveBattleSafe(payload, options) {
  try {
    await battleService.saveBattle(payload, options);
  } catch (e) {
    console.error('[pvpTacticalSimRunner] saveBattle 失败', {
      battleId: payload.battleId, playerId: payload.playerId, message: e.message, sqlMessage: e.sqlMessage,
    });
  }
}

/** 已 resolved 房间的结果摘要（幂等返回） */
function buildResultFromRow(row) {
  return {
    roomId: row.room_id,
    status: row.status,
    winnerSide: row.winner_side ?? null,
    winnerPlayerId: row.winner_player_id ?? null,
    rounds: null,
    eventSeq: row.event_seq ?? 0,
    battleIdA: row.battle_id_a ?? null,
    battleIdB: row.battle_id_b ?? null,
  };
}

/**
 * 真实链条（披挂①/道路②）专用：把一场**已在服务端推演完成**的战术对决，
 * 一步落为 `status='resolved'` 的房间 + 全量事件，供 `PvpTacticalBattleShell` 全量 replay。
 *
 * 与切磋流（invited→both_ready→sim_running→resolved）不同：本函数直接建 resolved 行，
 * 不做门闸/扣粮/快照冻结（调用方已自带冻结快照与推演结果）。room + events 同事务原子。
 * 仅供回放，**非**权威战果来源；调用方应 best-effort 包裹（落库失败不应阻断真实战斗结算）。
 *
 * 约定：canonical side a = 攻方（attacker），side b = 守方（defender，须为有效 player → FK）。
 *
 * @param {object} p
 * @param {string} p.attackerId
 * @param {string} p.defenderId
 * @param {string} [p.duelMapId]
 * @param {number} p.battleSeed
 * @param {{ a: object[], b: object[] }} p.lineupSnapshots
 * @param {{ events: object[], winnerSide: 'a'|'b'|null, finalState: object }} p.sim
 * @param {string} [p.battleIdA]
 * @param {string} [p.battleIdB]
 * @param {string|null} [p.season]
 * @returns {Promise<{ roomId: string, maxSeq: number }>}
 */
async function persistResolvedDuelRoom(p) {
  const {
    attackerId, defenderId, duelMapId = null, battleSeed,
    lineupSnapshots, sim, battleIdA = null, battleIdB = null, season = null,
  } = p || {};
  if (!attackerId || !defenderId) throw fail('BAD_REQUEST', 'persistResolvedDuelRoom 缺少 attackerId/defenderId', 400);
  if (!sim || !Array.isArray(sim.events) || !sim.finalState) {
    throw fail('BAD_REQUEST', 'persistResolvedDuelRoom 缺少 sim.events/finalState', 400);
  }
  if (!lineupSnapshots || !Array.isArray(lineupSnapshots.a) || !Array.isArray(lineupSnapshots.b)) {
    throw fail('BAD_REQUEST', 'persistResolvedDuelRoom 缺少 lineupSnapshots.{a,b}', 400);
  }

  const roomId = newShortBattleId('ptr');
  const events = sim.events;
  const winnerSide = sim.winnerSide ?? null;
  const winnerPlayerId = winnerSide === 'a' ? attackerId : winnerSide === 'b' ? defenderId : null;
  const maxSeq = events.length ? events[events.length - 1].seq : 0;
  const seedU32 = Number(battleSeed) >>> 0;

  await transaction(async (conn) => {
    await conn.query(
      `INSERT INTO pvp_tactical_rooms
         (room_id, season, player_a_id, player_b_id, canonical_attacker_id,
          duel_map_id, lineup_snapshot_json, battle_seed, event_seq,
          status, winner_side, winner_player_id, battle_id_a, battle_id_b,
          accepted_at, sim_started_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '${STATUS.RESOLVED}', ?, ?, ?, ?, NOW(), NOW(), NOW())`,
      [
        roomId, season, attackerId, defenderId, attackerId,
        duelMapId, JSON.stringify(lineupSnapshots), seedU32, maxSeq,
        winnerSide, winnerPlayerId, battleIdA, battleIdB,
      ],
    );
    if (events.length) {
      const placeholders = [];
      const values = [];
      for (const ev of events) {
        placeholders.push('(?, ?, ?, ?)');
        values.push(roomId, ev.seq, ev.type, JSON.stringify(ev.payload ?? null));
      }
      await conn.query(
        `INSERT INTO pvp_tactical_room_events (room_id, seq, type, payload_json) VALUES ${placeholders.join(', ')}`,
        values,
      );
    }
  });

  return { roomId, maxSeq };
}

/** 拉取房间事件（afterSeq 增量；供 §12.6 轮询 / 全量 replay） */
async function getRoomEvents(roomId, afterSeq = 0) {
  const [rows] = await pool.query(
    `SELECT seq, type, payload_json FROM pvp_tactical_room_events
      WHERE room_id = ? AND seq > ? ORDER BY seq ASC`,
    [roomId, Number(afterSeq) || 0],
  );
  return rows.map((r) => {
    let payload = null;
    try { payload = JSON.parse(r.payload_json || 'null'); } catch { payload = null; }
    return { seq: r.seq, type: r.type, payload };
  });
}

module.exports = {
  startRoom,
  getRoomEvents,
  persistResolvedDuelRoom,
};
