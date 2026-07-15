/**
 * PVP 战术对决 · 战报统计与评分（纯函数，无 DB；17-5-2 步骤 9 服务端切片）
 *
 * 从内核 `finalState`（[...a, ...b]，每单位含 initialTroops/currentTroops/alive）+ 冻结编组快照（提供 rarity）
 * 计算**单方视角**的：歼敌兵力（damageDealt）/ 自损兵力（damageTaken）/ 歼灭单位数（kills），并复用
 * `battleScore.cjs#calculateBattleScore`（与攻城 PVP / 前端同公式，17-1 §9）产出 `score` + `details`。
 *
 * 评分仅用于**战报展示**（`rewards.battleScore` / `rewards.scoreDetails`，见 18-1 §5）；
 * 是否计入活动排行 `player_statistics.total_battle_score`（友谊「阵前切磋」是否计分）为**产品决策**，
 * 由调用方显式决定，本模块不触库。
 *
 * @see docs/10-core-system/18-1-BATTLE_REPORT_SYSTEM.md §5
 * @see docs/10-core-system/17-5-2-TACTICAL_AUTO_DUEL_IMPLEMENTATION.md 步骤 9
 */

const { calculateBattleScore } = require('../../../utils/battleScore.cjs');

/** MVP 评分倍率（与 NPC 档一致 = 1；可调，见 17-5-2 步骤 9） */
const TACTICAL_DUEL_SCORE_MULT = 1;

/** 解析内核 instanceId `${side}_${index}`（side ∈ a|b） */
function parseInstanceId(instanceId) {
  const m = String(instanceId).match(/^([ab])_(\d+)$/);
  if (!m) return { side: null, index: -1 };
  return { side: m[1], index: Number(m[2]) };
}

/**
 * 构建 `calculateBattleScore` 入参：playerSide → faction 'player'，对方 → 'enemy'；rarity 取自快照。
 * @param {object} finalState 内核 finalState
 * @param {{a:object[], b:object[]}} lineupSnapshots canonical 双方快照
 * @param {'a'|'b'} playerSide 计分视角方
 */
function buildScoreTroops(finalState, lineupSnapshots, playerSide) {
  const out = [];
  for (const u of finalState?.units || []) {
    const { side, index } = parseInstanceId(u.instanceId);
    const snap = (lineupSnapshots?.[side] || [])[index] || {};
    out.push({
      faction: side === playerSide ? 'player' : 'enemy',
      rarity: snap.rarity || 'common',
      name: u.name,
      character: snap.character || null,
      initialTroops: Math.max(0, Number(u.initialTroops) || 0),
      currentTroops: Math.max(0, Number(u.currentTroops) || 0),
    });
  }
  return out;
}

/**
 * 单方视角统计（兵力人数量纲；用于 player_statistics 与战报摘要）。
 * @param {object} finalState
 * @param {'a'|'b'} playerSide
 * @returns {{ totalDamageDealt:number, totalDamageTaken:number, totalKills:number }}
 */
function buildSideStats(finalState, playerSide) {
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;
  let totalKills = 0;
  for (const u of finalState?.units || []) {
    const lost = Math.max(0, (Number(u.initialTroops) || 0) - (Number(u.currentTroops) || 0));
    if (u.side === playerSide) {
      totalDamageTaken += lost;
    } else {
      totalDamageDealt += lost;
      if (!u.alive) totalKills += 1;
    }
  }
  return { totalDamageDealt, totalDamageTaken, totalKills };
}

/**
 * 单方完整战报数值（统计 + 评分）。
 * @param {{ finalState:object, lineupSnapshots:object, playerSide:'a'|'b', rounds:number,
 *           result:'win'|'lose'|'draw', scoreMultiplier?:number }} params
 * @returns {{ totalDamageDealt:number, totalDamageTaken:number, totalKills:number, score:object }}
 */
function buildDuelReportForSide(params) {
  const { finalState, lineupSnapshots, playerSide, rounds, result, scoreMultiplier = TACTICAL_DUEL_SCORE_MULT } = params || {};
  const stats = buildSideStats(finalState, playerSide);
  const scoreTroops = buildScoreTroops(finalState, lineupSnapshots, playerSide);
  const score = calculateBattleScore(scoreTroops, rounds, result, { scoreMultiplier });
  return { ...stats, score };
}

module.exports = {
  TACTICAL_DUEL_SCORE_MULT,
  parseInstanceId,
  buildScoreTroops,
  buildSideStats,
  buildDuelReportForSide,
};
