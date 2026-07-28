/**
 * 披挂上阵 · 服务端权威结算（自动对决；仅 defenderGarrisonSlot === 0）（原 siegePvpResolveService · 17-5 §12.14）
 *
 * 17-2 §1.4 / §1.7：披挂上阵实时挑战只在「PVP 战事 active」状态下成立，
 * 战果一律写 `wars_pvp` via `pvpWarService.recordAttackerCitySiegeResult`，
 * 不再回写 `wars` (PVE) 表。
 *
 * 驻地 / NPC 异步分支：前端走客户端 BattleArena + /api/pvp-wars/:id/city-siege-result。
 */

const garrisonService = require('../../garrisonService');
const pvpService = require('../../pvpService');
const pvpWarService = require('../../pvpWarService');
const battleService = require('../../battleService');
const cityService = require('../../cityService');
const { hashSeed } = require('./pvpAutoDuelSim');
const { pool } = require('../../../database/connection');
const { buildDefenderPvpAutoDuelBattleLog } = require('./pvpAutoDuelBattleLog');
const { tacticalToAutoDuelResult } = require('../tactical/tacticalToAutoDuelResult');
const roomService = require('../tactical/pvpTacticalRoomService');
const simRunner = require('../tactical/pvpTacticalSimRunner');
const {
  calculateBattleScore,
  buildTroopsForAttackerScore,
  buildTroopsForDefenderScore,
  SIEGE_PVP_ONLINE_SCORE_MULT,
} = require('../../../utils/battleScore.cjs');
const { newShortBattleId } = require('../../../utils/battleId');

/** ESM 战术内核动态加载（缓存；17-5-3 阶段 4 接入真实披挂链条） */
let _kernelPromise = null;
function loadKernel() {
  if (!_kernelPromise) {
    _kernelPromise = import('../../../../shared/battle/tacticalSim/runPvpTacticalDuel.js');
  }
  return _kernelPromise;
}

function siegeNpcDisplayNames(npcs) {
  const names = [];
  for (const n of npcs || []) {
    const c = n.character;
    const label = (c && (c.courtesyName || c.name)) || n.troopName;
    if (label) names.push(String(label).trim());
  }
  return names;
}

/** 推演开战时双方总兵力（与 runPvpAutoDuel 入参 npc 一致） */
function sumSiegeNpcStartingTroops(npcs) {
  if (!Array.isArray(npcs)) return 0;
  return npcs.reduce((sum, n) => {
    const cur = n?.currentTroops;
    const mx = n?.maxTroops;
    const v = cur != null && cur !== '' ? Number(cur) : Number(mx);
    return sum + (Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
  }, 0);
}

/** 防止并发双次结算 */
const resolvingPromises = new Map();

function canResolveChallenge(c) {
  if (!c) return false;
  const now = Date.now();
  if (c.status === 'accepted') return true;
  if (c.status === 'timeout') return true;
  if (c.status === 'pending' && now >= c.expiresAt) return true;
  return false;
}

async function doResolveAuthoritativeGarrisonAutoDuel(params) {
  const { challengeId, attackerId } = params;
  const c = pvpService.peekChallenge(challengeId);
  if (!c) {
    const err = new Error('挑战不存在或已过期');
    err.code = 'CHALLENGE_NOT_FOUND';
    throw err;
  }
  if (c.attackerId !== attackerId) {
    const err = new Error('无权结算此挑战');
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (Number(c.defenderGarrisonSlot) !== 0) {
    const err = new Error('仅披挂上阵（槽位0）支持服务端权威结算');
    err.code = 'NOT_PVP_ON_DUTY';
    throw err;
  }
  if (!c.pvpWarId) {
    const err = new Error('披挂上阵实时挑战需在 PVP 战事下成立（缺少 pvpWarId）');
    err.code = 'NOT_PVP_WAR';
    throw err;
  }
  if (!canResolveChallenge(c)) {
    const err = new Error('挑战尚未进入可结算阶段');
    err.code = 'NOT_READY';
    throw err;
  }

  if (c.siegeOutcome) {
    return { success: true, ...c.siegeOutcome };
  }

  const rawAttacker = await garrisonService.buildDefenseUnitsFromMainLineup(attackerId);
  const rawDefender = await garrisonService.buildDefenseUnitsFromMainLineup(c.defenderId);
  const attackerNpcs = garrisonService.mapBuiltUnitsToSiegeNpcFormat(rawAttacker);
  const defenderNpcs = garrisonService.mapBuiltUnitsToSiegeNpcFormat(rawDefender);

  const initialAttackerTroops = sumSiegeNpcStartingTroops(attackerNpcs);
  const initialDefenderTroops = sumSiegeNpcStartingTroops(defenderNpcs);

  const seed = hashSeed([c.pvpWarId || c.warId, challengeId, attackerId, c.defenderId]);
  const city = c.cityId ? await cityService.getCityInfo(c.cityId) : null;
  const cityDefense = city?.defense ?? 100;

  // 17-5-3 阶段 4：战术内核 runPvpTacticalDuel 替换自动对决；经适配器回到 sim.* 同形（写回/计分/录战不动）。
  const duelMapId = await roomService.pickDuelMapIdForSeed(seed);
  const kernel = await loadKernel();
  const tactical = kernel.runPvpTacticalDuel({
    duelMapId,
    lineupSnapshots: { a: attackerNpcs, b: defenderNpcs },
    battleSeed: seed,
    sideLabels: { a: '攻方', b: '守军' },
    defenseBonus: { b: cityDefense }, // 守城方（canonical side b）享城防加成
  });
  const adapted = tacticalToAutoDuelResult({
    winnerSide: tactical.winnerSide,
    finalState: tactical.finalState,
    attackerSnapshot: attackerNpcs,
    defenderSnapshot: defenderNpcs,
  });
  const sim = {
    attackerWon: adapted.attackerWon,
    killedIndices: adapted.killedIndices,
    attackerTroopsEnd: adapted.attackerTroopsEnd,
    defenderTroopsEnd: adapted.defenderTroopsEnd,
    battleLog: tactical.battleLog,
    rounds: tactical.rounds,
    battleSeed: seed >>> 0,
  };
  const result = sim.attackerWon ? 'win' : 'lose';
  const killedIndices = sim.killedIndices;
  const battleLogText = (sim.battleLog || []).join('\n');

  // 战报 id 先行生成（供事件房间回填 battle_id_a/b 与 rewards.eventReplay）
  const battleId = newShortBattleId('pvp_siege_att');
  const defBattleId = newShortBattleId('pvp_siege_def');

  // 事件流回放房间（best-effort；与权威结算解耦，落库失败不阻断战果）
  let eventReplay = null;
  try {
    const { roomId, maxSeq } = await simRunner.persistResolvedDuelRoom({
      attackerId,
      defenderId: c.defenderId,
      duelMapId,
      battleSeed: seed,
      lineupSnapshots: { a: attackerNpcs, b: defenderNpcs },
      sim: { events: tactical.events, winnerSide: tactical.winnerSide, finalState: tactical.finalState },
      battleIdA: battleId,
      battleIdB: defBattleId,
      season: city?.season ?? null,
    });
    eventReplay = { source: 'pvp_tactical_room_events', roomId, maxSeq };
  } catch (e) {
    console.error('[pvpGarrisonAutoDuelResolve] persistResolvedDuelRoom', {
      message: e.message, attackerId, pvpWarId: c.pvpWarId,
    });
  }

  const atkTroops = buildTroopsForAttackerScore(sim.attackerTroopsEnd, sim.defenderTroopsEnd);
  const defTroops = buildTroopsForDefenderScore(sim.attackerTroopsEnd, sim.defenderTroopsEnd);
  const scoreMultOpts = { scoreMultiplier: SIEGE_PVP_ONLINE_SCORE_MULT };
  const atkBattleScore = calculateBattleScore(
    atkTroops,
    sim.rounds,
    sim.attackerWon ? 'victory' : 'defeat',
    scoreMultOpts,
  );
  const defBattleScore = calculateBattleScore(
    defTroops,
    sim.rounds,
    sim.attackerWon ? 'defeat' : 'victory',
    scoreMultOpts,
  );

  const [attNameRow] = await pool.query('SELECT character_name, faction_id FROM players WHERE player_id = ?', [attackerId]);
  const [defNameRow] = await pool.query('SELECT character_name FROM players WHERE player_id = ?', [c.defenderId]);
  const [cityRow] = await pool.query('SELECT city_name FROM cities WHERE city_id = ?', [c.cityId]);
  const cityName = cityRow[0]?.city_name || c.cityId;
  const attackerFaction = attNameRow[0]?.faction_id;
  const attackerName = attNameRow[0]?.character_name || attackerId;
  const defenderName = defNameRow[0]?.character_name || c.defenderId;

  const defenderPerspectiveLog = buildDefenderPvpAutoDuelBattleLog({
    battleLogLines: sim.battleLog,
    attackerPlayerName: attackerName,
    defenderPlayerName: defenderName,
    cityName,
  });

  const defenderLineupTroopUpdates = defenderNpcs.map((npc, i) => ({
    instanceId: npc._troopInstanceId,
    maxTroops: npc.maxTroops,
    currentTroops: Math.max(0, Math.round(Number(sim.defenderTroopsEnd[i]?.currentTroops) || 0)),
  })).filter((u) => u.instanceId);

  const recordPayload = await pvpWarService.recordAttackerCitySiegeResult(
    c.pvpWarId,
    attackerId,
    {
      defenderType: 'pvp_online',
      defenderPlayerId: c.defenderId,
      defenderGarrisonSlot: 0,
      garrisonUnits: defenderNpcs,
      defenderLineupTroopUpdates,
      killedIndices,
      result,
      silverSpent: 0,
    },
  );

  try {
    await garrisonService.applyAuthoritativePvpAutoDuelAttackerLineupCasualties(
      attackerId,
      attackerNpcs,
      sim.attackerTroopsEnd,
    );
  } catch (e) {
    console.error('[pvpGarrisonAutoDuelResolve] attacker lineup casualties', {
      message: e.message,
      attackerId,
      pvpWarId: c.pvpWarId,
    });
  }

  const siegeReplayAttackerNames = siegeNpcDisplayNames(attackerNpcs);
  const siegeReplayDefenderNames = siegeNpcDisplayNames(defenderNpcs);

  try {
    await battleService.saveBattle({
      battleId,
      playerId: attackerId,
      pvpWarId: c.pvpWarId,
      battleType: 'pvp_siege',
      opponentType: 'player',
      opponentId: c.defenderId,
      opponentName: defenderName,
      result: sim.attackerWon ? 'win' : 'lose',
      playerTeam: attackerNpcs.map((n) => ({
        name: n.character?.courtesyName || n.character?.name || n.troopName,
        courtesyName: n.character?.courtesyName || n.character?.name || n.troopName,
      })),
      opponentTeam: defenderNpcs.map((n) => ({
        name: n.character?.courtesyName || n.character?.name || n.troopName,
        courtesyName: n.character?.courtesyName || n.character?.name || n.troopName,
      })),
      battleLog: battleLogText,
      totalKills: killedIndices.length,
      duration: sim.rounds,
      rewards: {
        battleSeed: sim.battleSeed,
        authoritative: true,
        battleScore: atkBattleScore.score,
        battleGrade: atkBattleScore.grade,
        scoreDetails: atkBattleScore.details,
        initialAttackerTroops,
        initialDefenderTroops,
        ...(eventReplay ? { eventReplay } : {}),
      },
    });
  } catch (e) {
    console.error('[pvpGarrisonAutoDuelResolve] saveBattle attacker', {
      message: e.message,
      code: e.code,
      sqlMessage: e.sqlMessage,
      battleId,
      attackerId,
      pvpWarId: c.pvpWarId,
    });
  }

  try {
    await battleService.saveBattle({
      battleId: defBattleId,
      playerId: c.defenderId,
      pvpWarId: c.pvpWarId,
      battleType: 'pvp_defense',
      opponentType: 'player',
      opponentId: attackerId,
      opponentName: attackerName,
      result: sim.attackerWon ? 'lose' : 'win',
      playerTeam: defenderNpcs.map((n) => ({
        name: n.character?.courtesyName || n.character?.name || n.troopName,
        courtesyName: n.character?.courtesyName || n.character?.name || n.troopName,
      })),
      opponentTeam: attackerNpcs.map((n) => ({
        name: n.character?.courtesyName || n.character?.name || n.troopName,
        courtesyName: n.character?.courtesyName || n.character?.name || n.troopName,
      })),
      battleLog: defenderPerspectiveLog,
      totalKills: killedIndices.length,
      duration: sim.rounds,
      rewards: {
        battleScore: defBattleScore.score,
        battleGrade: defBattleScore.grade,
        scoreDetails: defBattleScore.details,
        initialAttackerTroops,
        initialDefenderTroops,
        /** 仅旧「次攻击」协议可供简化回放；回合摘要战报改走 eventReplay */
        ...( /次攻击/.test(battleLogText) ? { autoDuelBattleLog: battleLogText } : {}),
        ...(eventReplay ? { eventReplay } : {}),
      },
      recordOnly: true,
    });
  } catch (e) {
    console.error('[pvpGarrisonAutoDuelResolve] saveBattle defender', {
      message: e.message,
      code: e.code,
      sqlMessage: e.sqlMessage,
      battleId: defBattleId,
      defenderId: c.defenderId,
      pvpWarId: c.pvpWarId,
    });
  }

  // 与 POST /api/battles 一致：战报积分写入排行榜（服务端存战报不经由 HTTP）
  try {
    if (atkBattleScore.score > 0) {
      await pool.query(
        'UPDATE player_statistics SET total_battle_score = total_battle_score + ? WHERE player_id = ?',
        [atkBattleScore.score, attackerId],
      );
    }
    if (defBattleScore.score > 0) {
      await pool.query(
        'UPDATE player_statistics SET total_battle_score = total_battle_score + ? WHERE player_id = ?',
        [defBattleScore.score, c.defenderId],
      );
    }
  } catch (e) {
    console.error('[pvpGarrisonAutoDuelResolve] player_statistics battle score', e);
  }

  const outcome = {
    attackerWon: sim.attackerWon,
    battleSeed: sim.battleSeed,
    battleLog: sim.battleLog,
    siegeData: recordPayload,
    warId: c.warId || null,
    pvpWarId: c.pvpWarId,
    cityId: c.cityId,
    defenderId: c.defenderId,
    attackerId,
    result,
    killedIndices,
    siegeReplayAttackerNames,
    siegeReplayDefenderNames,
    initialAttackerTroops,
    initialDefenderTroops,
    /** 防守方弹窗：与战报列表一致的评分展示 */
    defenderBattleScore: defBattleScore.score,
    defenderBattleGrade: defBattleScore.grade,
    defenderScoreDetails: defBattleScore.details,
    ...(eventReplay ? { eventReplay } : {}),
  };

  pvpService.markSiegeResolved(challengeId, outcome);

  return {
    success: true,
    attackerWon: sim.attackerWon,
    battleSeed: sim.battleSeed,
    battleLog: sim.battleLog,
    killedIndices,
    result,
    siegeData: recordPayload,
    warId: c.warId || null,
    pvpWarId: c.pvpWarId,
    cityId: c.cityId,
    defenderId: c.defenderId,
    attackerId,
    siegeReplayAttackerNames,
    siegeReplayDefenderNames,
    initialAttackerTroops,
    initialDefenderTroops,
    ...(eventReplay ? { eventReplay } : {}),
  };
}

/**
 * @param {{ challengeId: string, attackerId: string }} params
 */
async function resolveAuthoritativeGarrisonAutoDuel(params) {
  const { challengeId } = params;
  if (resolvingPromises.has(challengeId)) {
    return resolvingPromises.get(challengeId);
  }
  const p = doResolveAuthoritativeGarrisonAutoDuel(params).finally(() => {
    resolvingPromises.delete(challengeId);
  });
  resolvingPromises.set(challengeId, p);
  return p;
}

module.exports = {
  resolveAuthoritativeGarrisonAutoDuel,
  canResolveChallenge,
};
