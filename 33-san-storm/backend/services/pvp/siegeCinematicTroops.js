/**
 * 攻城冲锋动画用部队快照：与真实战果对齐的展示层辅助。
 */

function unitDisplayName(n) {
  if (!n || typeof n !== 'object') return '部队';
  return (
    n.character?.courtesyName ||
    n.character?.name ||
    n.troopName ||
    n.name ||
    '部队'
  );
}

/**
 * 冲锋动画 / TroopLayer 用快照。
 * NPC 守军常有 maxTroops + alive、无 currentTroops；缺省时按满编（alive!==false）。
 * @param {object[]} units
 */
function snapshotSiegeUnitsForCinematic(units) {
  return (Array.isArray(units) ? units : []).map((n, i) => {
    const maxTroops = Math.max(
      0,
      Math.round(Number(n.maxTroops ?? n.currentTroops) || 0),
    );
    const rawCur = n.currentTroops;
    const parsedCur =
      rawCur != null && rawCur !== '' ? Number(rawCur) : NaN;
    const currentTroops = Number.isFinite(parsedCur)
      ? Math.max(0, Math.round(parsedCur))
      : n.alive === false
        ? 0
        : maxTroops;
    const troopId = n.troopId || n.id || null;
    const displayName = unitDisplayName(n);
    return {
      index: i,
      id: troopId != null ? `${troopId}_${i}` : `siege_${i}`,
      troopId,
      name: n.troopName || n.name || displayName,
      displayName,
      currentTroops,
      maxTroops: maxTroops || currentTroops,
      rarity: n.rarity || 'common',
      troopType: n.troopType || null,
      weaponType: n.weaponType || null,
      morale: Number.isFinite(Number(n.morale)) ? Math.round(Number(n.morale)) : 100,
    };
  });
}

/**
 * @param {ReturnType<typeof snapshotSiegeUnitsForCinematic>} initialSnap
 * @param {Array<{ currentTroops?: number }>|null|undefined} endArr
 */
function mapEndTroopsForCinematic(initialSnap, endArr) {
  return (initialSnap || []).map((s, i) => ({
    ...s,
    currentTroops: Math.max(0, Math.round(Number(endArr?.[i]?.currentTroops) || 0)),
  }));
}

/**
 * 终帧硬规则：胜方至少一支残兵，败方全部清零（以服务端 end 为底再 clamp）。
 * @param {boolean} attackerWon
 */
function alignCinematicEndByWinner(attackerWon, atkEnd, defEnd) {
  const atk = (atkEnd || []).map((t) => ({ ...t }));
  const def = (defEnd || []).map((t) => ({ ...t }));
  if (attackerWon) {
    for (const t of def) t.currentTroops = 0;
    if (atk.length && !atk.some((t) => t.currentTroops > 0)) {
      atk[0].currentTroops = Math.max(1, Math.round(Number(atk[0].maxTroops) * 0.1) || 1);
    }
  } else {
    for (const t of atk) t.currentTroops = 0;
    if (def.length && !def.some((t) => t.currentTroops > 0)) {
      def[0].currentTroops = Math.max(1, Math.round(Number(def[0].maxTroops) * 0.1) || 1);
    }
  }
  return { attackerTroopsEnd: atk, defenderTroopsEnd: def };
}

/**
 * 从推演收尾兵力收集击杀下标。
 * - `npc_global`：写回 cities.npc_garrison / 大本营 JSON 的全局 `.index`
 * - `local`：写回玩家驻地批次的数组下标（0..n-1）
 *
 * 注意：`tacticalToAutoDuelResult.killedIndices` 在 snap 带 `.index` 时已是全局下标，
 * 不可再按「本批长度」过滤后当成本地下标去二次 map（第二批起全局下标 ≥4 会被误丢光）。
 *
 * @param {object[]} defenderNpcs
 * @param {Array<{ currentTroops?: number }>|null|undefined} defenderTroopsEnd
 * @param {'npc_global'|'local'} mode
 * @returns {number[]}
 */
function collectSiegeKilledIndices(defenderNpcs, defenderTroopsEnd, mode = 'npc_global') {
  const out = [];
  const list = Array.isArray(defenderNpcs) ? defenderNpcs : [];
  for (let i = 0; i < list.length; i++) {
    const hp = Math.max(0, Math.round(Number(defenderTroopsEnd?.[i]?.currentTroops) || 0));
    if (hp > 0) continue;
    if (mode === 'local') {
      out.push(i);
      continue;
    }
    const gi = list[i]?.index;
    if (gi != null && Number.isFinite(Number(gi))) out.push(Number(gi));
  }
  return Array.from(new Set(out));
}

/** 与前端 getSiegeBattleScoreMultiplier 对齐 */
function siegeScoreMultiplierForDefenderType(defenderType) {
  if (defenderType === 'player_garrison') return 1.5;
  if (defenderType === 'pvp_online') return 2;
  return 1;
}

/**
 * 权威攻城战后写进攻方战报（best-effort；失败不阻断结算）。
 * 须传入 attackerTroopsEnd / defenderTroopsEnd（tacticalToAutoDuelResult 同形）以便计分。
 * @returns {Promise<boolean>} 是否落库成功
 */
async function saveAuthoritativeSiegeAttackerBattleReport(opts) {
  const battleService = require('../battleService');
  const { newShortBattleId } = require('../../utils/battleId');
  const {
    calculateBattleScore,
    buildTroopsForAttackerScore,
  } = require('../../utils/battleScore.cjs');
  const {
    playerId,
    battleType,
    warId = null,
    pvpWarId = null,
    opponentType = 'npc',
    opponentId = null,
    opponentName,
    result,
    attackerNpcs = [],
    defenderNpcs = [],
    attackerTroopsEnd = null,
    defenderTroopsEnd = null,
    defenderType = 'npc',
    battleLog = '',
    totalKills = 0,
    rounds = 0,
    rewards = {},
  } = opts || {};
  if (!playerId) return false;
  const prefix =
    battleType === 'pve_siege' ? 'pve_siege' : battleType === 'pvp_siege' ? 'pvp_siege' : 'siege_auto';
  const battleId = newShortBattleId(prefix);

  const roundNum = Math.max(1, Math.round(Number(rounds) || 1));
  const perspective = result === 'win' ? 'victory' : 'defeat';
  let scoreResult = { score: 0, grade: '-', details: {} };
  try {
    const atkEnd = Array.isArray(attackerTroopsEnd) ? attackerTroopsEnd : [];
    const defEnd = Array.isArray(defenderTroopsEnd) ? defenderTroopsEnd : [];
    if (atkEnd.length || defEnd.length) {
      const scoreTroops = buildTroopsForAttackerScore(atkEnd, defEnd);
      scoreResult = calculateBattleScore(scoreTroops, roundNum, perspective, {
        scoreMultiplier: siegeScoreMultiplierForDefenderType(defenderType),
      });
    }
  } catch (e) {
    console.error('[siegeCinematicTroops] calculateBattleScore', e.message);
  }

  const mergedRewards = {
    authoritative: true,
    battleScore: scoreResult.score,
    battleGrade: scoreResult.grade,
    scoreDetails: scoreResult.details,
    ...(rewards || {}),
  };

  try {
    await battleService.saveBattle({
      battleId,
      playerId,
      warId: warId || null,
      pvpWarId: pvpWarId || null,
      battleType,
      opponentType,
      opponentId,
      opponentName: opponentName || '守军',
      result,
      playerTeam: (attackerNpcs || []).map((n) => ({
        name: unitDisplayName(n),
        rarity: n.rarity || 'common',
      })),
      opponentTeam: (defenderNpcs || []).map((n) => ({
        name: unitDisplayName(n),
        rarity: n.rarity || 'common',
      })),
      battleLog: typeof battleLog === 'string' ? battleLog : String(battleLog || ''),
      totalKills: Math.max(0, Number(totalKills) || 0),
      duration: roundNum,
      rewards: mergedRewards,
    });
    try {
      await battleService.applyBattleScore(playerId, scoreResult.score);
    } catch (_) {
      /* ignore */
    }
    return true;
  } catch (e) {
    console.error('[siegeCinematicTroops] saveAuthoritativeSiegeAttackerBattleReport', {
      message: e.message,
      playerId,
      battleType,
      warId,
      pvpWarId,
    });
    return false;
  }
}

module.exports = {
  snapshotSiegeUnitsForCinematic,
  mapEndTroopsForCinematic,
  alignCinematicEndByWinner,
  collectSiegeKilledIndices,
  saveAuthoritativeSiegeAttackerBattleReport,
  unitDisplayName,
};
