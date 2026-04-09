/**
 * 与前端 game/src/systems/battleScoreSystem.js 同公式，供服务端攻城 PVP 结算写战报积分。
 * 术语与战报 UI 一致：歼敌评分、战损评分；战损保底（歼敌×0.3）/ 安慰保底见源码注释。
 * 评分 = 各部队 round(基础分×损失比例) 之和；与 killTroops/lossTroops（兵力人数）不同量纲。
 */

// ── 歼敌评分：稀有度基础分表（不从 maxTroops 推导；core=800 与部队配置默认上限对齐） ──
const KILL_SCORE = {
  common: 200,
  rare: 330,
  epic: 460,
  legendary: 600,
  core: 800,
};

// ── 战损评分：稀有度惩罚分表 ──
const LOSS_PENALTY = {
  common: -300,
  rare: -495,
  epic: -690,
  legendary: -900,
  core: -1200,
};

const TURN_MULTIPLIER = {
  1: 1.4, 2: 1.3, 3: 1.2, 4: 1.15,
  5: 1.1, 6: 1.05, 7: 1.0, 8: 1.0,
  9: 1.0, 10: 1.0,
};

const GRADE_THRESHOLDS = [
  { grade: 'S', min: 5000, label: '完美！', multiplier: 2.0 },
  { grade: 'A', min: 3000, label: '优秀！', multiplier: 1.5 },
  { grade: 'B', min: 1000, label: '良好', multiplier: 1.2 },
  { grade: 'C', min: 500, label: '及格', multiplier: 1.0 },
  { grade: 'D', min: 0, label: '勉强', multiplier: 0.8 },
];

function troopLabel(t) {
  return t.character?.courtesyName || t.character?.name || t.name || '未知';
}

/**
 * @param {Array} battleTroops faction: player | enemy
 * @param {{ scoreMultiplier?: number }} [options]
 */
function calculateBattleScore(battleTroops, roundNum, result, options = {}) {
  const scoreMultiplier =
    typeof options.scoreMultiplier === 'number' && options.scoreMultiplier > 0 ? options.scoreMultiplier : 1;

  let killScore = 0;
  let lossScore = 0;
  // 歼敌兵力 / 战损兵力（兵力单位，非评分项）
  let killTroops = 0;
  let lossTroops = 0;
  const killDetails = [];
  const lossDetails = [];

  for (const troop of battleTroops) {
    const rarity = troop.rarity || 'common';
    // 评分基准改为「开战时实际兵力」，避免把低兵力入场按满编损失计分
    const start = Number.isFinite(Number(troop.initialTroops))
      ? Math.max(0, Number(troop.initialTroops))
      : Math.max(0, Number(troop.maxTroops || 0));
    const cur = Math.max(0, troop.currentTroops || 0);
    if (start <= 0) continue;
    const lostRatio = Math.max(0, Math.min(1, (start - cur) / start));
    const deltaTroops = Math.max(0, start - cur);
    if (troop.faction === 'enemy') killTroops += deltaTroops;
    if (troop.faction === 'player') lossTroops += deltaTroops;

    if (troop.faction === 'enemy' && lostRatio > 0) {
      const base = KILL_SCORE[rarity] || 200;
      const pts = Math.round(base * lostRatio);
      killScore += pts;
      const pctStr = Math.round(lostRatio * 100);
      killDetails.push({ name: troopLabel(troop), rarity, pts, pct: pctStr, startTroops: start, remainTroops: cur });
    }

    if (troop.faction === 'player' && lostRatio > 0) {
      // 己方阵营：损失比例 × 战损惩罚分 → 战损评分
      const base = LOSS_PENALTY[rarity] || -300;
      const pts = Math.round(base * lostRatio);
      lossScore += pts;
      const pctStr = Math.round(lostRatio * 100);
      lossDetails.push({ name: troopLabel(troop), rarity, pts, pct: pctStr, startTroops: start, remainTroops: cur });
    }
  }

  const baseScore = killScore + lossScore;
  const turnMult = TURN_MULTIPLIER[Math.min(roundNum, 10)] ?? 1.0;
  const normalScore = Math.round(baseScore * turnMult);
  // 战损保底：歼敌评分 × 0.3（战报③「触发」= preSiegeScore===floorScore 且 floorScore>0）
  const floorScore = Math.round(killScore * 0.3);
  // 安慰保底：歼敌=0 时战损×0.3（战报④「触发」= preSiegeScore===comfortFloorScore 且 comfortFloorScore>0）
  const comfortFloorScore =
    killScore === 0 && lossScore < 0 ? Math.round(Math.abs(lossScore) * 0.3) : 0;
  const preSiegeScore = Math.max(normalScore, floorScore, comfortFloorScore);
  let finalScore = Math.round(preSiegeScore * scoreMultiplier);

  const gradeInfo = GRADE_THRESHOLDS.find((g) => finalScore >= g.min) || GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1];

  return {
    score: finalScore,
    grade: gradeInfo.grade,
    gradeLabel: gradeInfo.label,
    gradeMultiplier: gradeInfo.multiplier,
    details: {
      killScore,
      lossScore,
      killTroops,
      lossTroops,
      baseScore,
      turnMultiplier: turnMult,
      roundNum,
      kills: killDetails,
      losses: lossDetails,
      siegeScoreMultiplier: scoreMultiplier !== 1 ? scoreMultiplier : undefined,
      /** 用于战报展示：非「基础分×回合×攻城」连乘 */
      normalScore,
      floorScore,
      floorScoreRule: 0.3,
      comfortFloorScore,
      comfortFloorRule: 0.3,
      preSiegeScore,
    },
  };
}

/** 攻城方视角：playerTroops = 攻城方 */
function buildTroopsForAttackerScore(playerTroops, enemyTroops) {
  return [...playerTroops, ...enemyTroops];
}

/** 守城方视角 */
function buildTroopsForDefenderScore(playerTroops, enemyTroops) {
  return [
    ...enemyTroops.map((t) => ({ ...t, faction: 'player' })),
    ...playerTroops.map((t) => ({ ...t, faction: 'enemy' })),
  ];
}

/** 披挂上阵攻城：与前端 getSiegeBattleScoreMultiplier('pvp_online') 一致 */
const SIEGE_PVP_ONLINE_SCORE_MULT = 2;

module.exports = {
  calculateBattleScore,
  buildTroopsForAttackerScore,
  buildTroopsForDefenderScore,
  SIEGE_PVP_ONLINE_SCORE_MULT,
};
