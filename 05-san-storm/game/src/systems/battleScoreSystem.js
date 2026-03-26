/**
 * 战后评分系统
 * 
 * @description 根据战斗结果计算评分，用于排行榜积分
 * @see 15-STATISTICS_RANKING_SYSTEM.md
 * 
 * 评分项：消灭/消耗敌兵、己方损失、回合倍率
 * 
 * 计算方式（按兵力损失比例）：
 *   敌方：损失比例 × 稀有度基础分（全灭=100%=满分）
 *   己方：损失比例 × 稀有度惩罚分（全灭=100%=满额扣分）
 */

// ── 消灭敌兵基础积分（按稀有度，100%损失时的满分） ──
const KILL_SCORE = {
  common: 200,
  rare: 330,
  epic: 460,
  legendary: 600,
  core: 990,
};

// ── 己方损失扣分（基础 × 1.5，100%损失时的满额扣分） ──
const LOSS_PENALTY = {
  common: -300,
  rare: -495,
  epic: -690,
  legendary: -900,
  core: -1485,
};

// ── 回合倍率 ──
const TURN_MULTIPLIER = {
  1: 1.40, 2: 1.30, 3: 1.20, 4: 1.15,
  5: 1.10, 6: 1.05, 7: 1.00, 8: 1.00,
  9: 1.00, 10: 1.00,
};

// ── 评级阈值 ──
const GRADE_THRESHOLDS = [
  { grade: 'S', min: 3000, label: '完美！', multiplier: 2.0 },
  { grade: 'A', min: 2000, label: '优秀！', multiplier: 1.5 },
  { grade: 'B', min: 1000, label: '良好',   multiplier: 1.2 },
  { grade: 'C', min: 500,  label: '及格',   multiplier: 1.0 },
  { grade: 'D', min: 0,    label: '勉强',   multiplier: 0.8 },
];

/**
 * 根据战斗结束后的部队状态计算评分
 * 
 * @param {Array} battleTroops - 所有部队（含 faction, rarity, currentTroops, maxTroops）
 * @param {number} roundNum - 战斗结束时的回合数
 * @param {string} result - 'victory' | 'defeat'
 * @returns {{ score, grade, details }}
 */
export function calculateBattleScore(battleTroops, roundNum, result) {
  let killScore = 0;
  let lossScore = 0;
  const killDetails = [];
  const lossDetails = [];

  for (const troop of battleTroops) {
    const rarity = troop.rarity || 'common';
    const max = troop.maxTroops || 1;
    const cur = Math.max(0, troop.currentTroops || 0);
    const lostRatio = (max - cur) / max; // 0~1

    if (troop.faction === 'enemy' && lostRatio > 0) {
      // 敌方兵力损失：比例 × 基础分
      const base = KILL_SCORE[rarity] || 200;
      const pts = Math.round(base * lostRatio);
      killScore += pts;
      const pctStr = Math.round(lostRatio * 100);
      killDetails.push({ name: troopLabel(troop), rarity, pts, pct: pctStr });
    }

    if (troop.faction === 'player' && lostRatio > 0) {
      // 己方兵力损失：比例 × 惩罚分
      const base = LOSS_PENALTY[rarity] || -300;
      const pts = Math.round(base * lostRatio);
      lossScore += pts;
      const pctStr = Math.round(lostRatio * 100);
      lossDetails.push({ name: troopLabel(troop), rarity, pts, pct: pctStr });
    }
  }

  const baseScore = killScore + lossScore;
  const turnMult = TURN_MULTIPLIER[Math.min(roundNum, 10)] ?? 1.0;
  const normalScore = Math.round(baseScore * turnMult);

  // 保底积分：敌方消耗分 × 0.3（惨胜/败方不至于0分）
  const floorScore = Math.round(killScore * 0.3);
  const finalScore = Math.max(normalScore, floorScore);

  // 评级
  const gradeInfo = GRADE_THRESHOLDS.find(g => finalScore >= g.min) || GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1];

  return {
    score: finalScore,
    grade: gradeInfo.grade,
    gradeLabel: gradeInfo.label,
    gradeMultiplier: gradeInfo.multiplier,
    details: {
      killScore,
      lossScore,
      baseScore,
      turnMultiplier: turnMult,
      roundNum,
      kills: killDetails,
      losses: lossDetails,
    },
  };
}

function troopLabel(t) {
  return t.character?.courtesyName || t.character?.name || t.name || '未知';
}
