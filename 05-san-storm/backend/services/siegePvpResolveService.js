/**
 * 披挂上阵 · 服务端权威结算（仅 defenderGarrisonSlot === 0）
 * 驻地 / NPC 仍走客户端 BattleArena + /cities/siege-result
 */

const cityService = require('./cityService');
const garrisonService = require('./garrisonService');
const pvpService = require('./pvpService');
const battleService = require('./battleService');
const { runSiegePvpSkirmish, hashSeed } = require('./siegePvpSkirmish');
const { pool } = require('../database/connection');
const { buildDefenderSiegePvpBattleLog } = require('../utils/siegeDefenseBattleLog');
const {
  calculateBattleScore,
  buildTroopsForAttackerScore,
  buildTroopsForDefenderScore,
  SIEGE_PVP_ONLINE_SCORE_MULT,
} = require('../utils/battleScore.cjs');
const { newShortBattleId } = require('../utils/battleId');

function siegeNpcDisplayNames(npcs) {
  const names = [];
  for (const n of npcs || []) {
    const c = n.character;
    const label = (c && (c.courtesyName || c.name)) || n.troopName;
    if (label) names.push(String(label).trim());
  }
  return names;
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

async function doResolveAuthoritativeSiegePvp(params) {
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

  const seed = hashSeed([c.warId, challengeId, attackerId, c.defenderId]);
  const sim = runSiegePvpSkirmish(attackerNpcs, defenderNpcs, seed);
  const result = sim.attackerWon ? 'win' : 'lose';
  const killedIndices = sim.killedIndices;
  const battleLogText = sim.battleLog.join('\n');

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
  const [cityRow] = await pool.query('SELECT city_name FROM cities WHERE id = ?', [c.cityId]);
  const cityName = cityRow[0]?.city_name || c.cityId;
  const attackerFaction = attNameRow[0]?.faction_id;
  const attackerName = attNameRow[0]?.character_name || attackerId;
  const defenderName = defNameRow[0]?.character_name || c.defenderId;

  const defenderPerspectiveLog = buildDefenderSiegePvpBattleLog({
    battleLogLines: sim.battleLog,
    attackerNpcs,
    defenderNpcs,
    attackerPlayerName: attackerName,
    defenderPlayerName: defenderName,
    cityName,
  });

  const defenderLineupTroopUpdates = defenderNpcs.map((npc, i) => ({
    instanceId: npc._troopInstanceId,
    maxTroops: npc.maxTroops,
    currentTroops: Math.max(0, Math.round(Number(sim.defenderTroopsEnd[i]?.currentTroops) || 0)),
  })).filter((u) => u.instanceId);

  const recordPayload = await cityService.recordSiegeResult(
    c.warId,
    attackerId,
    attackerFaction,
    killedIndices,
    result,
    0,
    {
      defenderType: 'pvp_online',
      defenderPlayerId: c.defenderId,
      defenderGarrisonSlot: 0,
      garrisonUnits: defenderNpcs,
      defenderLineupTroopUpdates,
    },
  );

  try {
    await garrisonService.applyAuthoritativeSiegePvpAttackerLineupCasualties(
      attackerId,
      attackerNpcs,
      sim.attackerTroopsEnd,
    );
  } catch (e) {
    console.error('[siegePvpResolve] attacker lineup casualties', {
      message: e.message,
      attackerId,
      warId: c.warId,
    });
  }

  const siegeReplayAttackerNames = siegeNpcDisplayNames(attackerNpcs);
  const siegeReplayDefenderNames = siegeNpcDisplayNames(defenderNpcs);

  const battleId = newShortBattleId('pvp_siege_att');
  try {
    await battleService.saveBattle({
      battleId,
      playerId: attackerId,
      warId: c.warId,
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
      },
    });
  } catch (e) {
    console.error('[siegePvpResolve] saveBattle attacker', {
      message: e.message,
      code: e.code,
      sqlMessage: e.sqlMessage,
      battleId,
      attackerId,
      warId: c.warId,
    });
  }

  const defBattleId = newShortBattleId('pvp_siege_def');
  try {
    await battleService.saveBattle({
      battleId: defBattleId,
      playerId: c.defenderId,
      warId: c.warId,
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
      },
      recordOnly: true,
    });
  } catch (e) {
    console.error('[siegePvpResolve] saveBattle defender', {
      message: e.message,
      code: e.code,
      sqlMessage: e.sqlMessage,
      battleId: defBattleId,
      defenderId: c.defenderId,
      warId: c.warId,
    });
  }

  // 与 POST /api/battles 一致：战报积分写入排行榜（服务端存战报不经由 HTTP）
  try {
    if (atkBattleScore.score > 0) {
      await pool.query(
        'UPDATE statistics SET total_battle_score = total_battle_score + ? WHERE player_id = ?',
        [atkBattleScore.score, attackerId],
      );
    }
    if (defBattleScore.score > 0) {
      await pool.query(
        'UPDATE statistics SET total_battle_score = total_battle_score + ? WHERE player_id = ?',
        [defBattleScore.score, c.defenderId],
      );
    }
  } catch (e) {
    console.error('[siegePvpResolve] statistics battle score', e);
  }

  const outcome = {
    attackerWon: sim.attackerWon,
    battleSeed: sim.battleSeed,
    battleLog: sim.battleLog,
    siegeData: recordPayload,
    warId: c.warId,
    cityId: c.cityId,
    defenderId: c.defenderId,
    attackerId,
    result,
    killedIndices,
    siegeReplayAttackerNames,
    siegeReplayDefenderNames,
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
    warId: c.warId,
    cityId: c.cityId,
    defenderId: c.defenderId,
    attackerId,
    siegeReplayAttackerNames,
    siegeReplayDefenderNames,
  };
}

/**
 * @param {{ challengeId: string, attackerId: string }} params
 */
async function resolveAuthoritativeSiegePvp(params) {
  const { challengeId } = params;
  if (resolvingPromises.has(challengeId)) {
    return resolvingPromises.get(challengeId);
  }
  const p = doResolveAuthoritativeSiegePvp(params).finally(() => {
    resolvingPromises.delete(challengeId);
  });
  resolvingPromises.set(challengeId, p);
  return p;
}

module.exports = {
  resolveAuthoritativeSiegePvp,
  canResolveChallenge,
};
