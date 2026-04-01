/**
 * 战后评分系统
 * 
 * @description 根据战斗结果计算评分，用于排行榜积分
 * @see 19-1-STATISTICS_RANKING_SYSTEM.md
 * 
 * 评分项：歼敌评分、战损评分、回合倍率（与战报 UI 一致）
 * 
 * 计算方式（按兵力损失比例）：
 *   敌对阵营：损失比例 × 稀有度歼敌基础分（全灭=100% 对应该部队歼敌评分满分）
 *   己方阵营：损失比例 × 稀有度战损惩罚分（全灭=100% 对应该部队战损评分满额扣分）
 */

// ── 歼敌评分：稀有度基础分表（单部队 100% 损失时的满分贡献） ──
const KILL_SCORE = {
  common: 200,
  rare: 330,
  epic: 460,
  legendary: 600,
  core: 990,
};

// ── 战损评分：稀有度惩罚分表（单部队 100% 损失时的满额扣分贡献） ──
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
 * @param {{ scoreMultiplier?: number }} [options] 攻城等对玩家战：驻军编组 1.5、披挂上阵 2（与 NPC 守军区分）
 * @returns {{ score, grade, details }}
 */
export function calculateBattleScore(battleTroops, roundNum, result, options = {}) {
  const scoreMultiplier =
    typeof options.scoreMultiplier === 'number' && options.scoreMultiplier > 0 ? options.scoreMultiplier : 1;
  let killScore = 0;
  let lossScore = 0;
  /** 歼敌兵力：敌对阵营损失合计（兵力单位，非评分项） */
  let killTroops = 0;
  /** 战损兵力：己方阵营损失合计 */
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
    const lostRatio = Math.max(0, Math.min(1, (start - cur) / start)); // 0~1
    const deltaTroops = Math.max(0, start - cur);
    if (troop.faction === 'enemy') killTroops += deltaTroops;
    if (troop.faction === 'player') lossTroops += deltaTroops;

    if (troop.faction === 'enemy' && lostRatio > 0) {
      // 敌对阵营：损失比例 × 歼敌基础分 → 累加为歼敌评分
      const base = KILL_SCORE[rarity] || 200;
      const pts = Math.round(base * lostRatio);
      killScore += pts;
      const pctStr = Math.round(lostRatio * 100);
      killDetails.push({ name: troopLabel(troop), rarity, pts, pct: pctStr, startTroops: start, remainTroops: cur });
    }

    if (troop.faction === 'player' && lostRatio > 0) {
      // 己方阵营：损失比例 × 战损惩罚分 → 累加为战损评分
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

  // 惨败保底：歼敌评分 × 0.3
  const floorScore = Math.round(killScore * 0.3);
  // 安慰保底：当歼敌评分 = 0 时，战损评分 × 0.3（实现上对战损为负取绝对值折算）
  const comfortFloorScore =
    killScore === 0 && lossScore < 0 ? Math.round(Math.abs(lossScore) * 0.3) : 0;
  const preSiegeScore = Math.max(normalScore, floorScore, comfortFloorScore);
  let finalScore = Math.round(preSiegeScore * scoreMultiplier);

  // 评级（按倍率后的最终分）
  const gradeInfo = GRADE_THRESHOLDS.find(g => finalScore >= g.min) || GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1];

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
      normalScore,
      floorScore,
      floorScoreRule: 0.3,
      comfortFloorScore,
      comfortFloorRule: 0.3,
      preSiegeScore,
    },
  };
}

function troopLabel(t) {
  return t.character?.courtesyName || t.character?.name || t.name || '未知';
}

/**
 * 战报 UI：歼敌/战损兵力数。新存档含 `killTroops`/`lossTroops`；旧档可从 kills/losses 明细还原。
 * @returns {{ killTroops: number, lossTroops: number } | { killTroops: null, lossTroops: null }}
 */
export function resolveKillLossTroopCounts(details) {
  if (!details) return { killTroops: null, lossTroops: null };
  if (Number.isFinite(details.killTroops) && Number.isFinite(details.lossTroops)) {
    return { killTroops: details.killTroops, lossTroops: details.lossTroops };
  }
  let k = 0;
  let l = 0;
  if (Array.isArray(details.kills)) {
    for (const x of details.kills) {
      k += Math.max(0, (Number(x.startTroops) || 0) - (Number(x.remainTroops) || 0));
    }
  }
  if (Array.isArray(details.losses)) {
    for (const x of details.losses) {
      l += Math.max(0, (Number(x.startTroops) || 0) - (Number(x.remainTroops) || 0));
    }
  }
  const hasKills = Array.isArray(details.kills) && details.kills.length > 0;
  const hasLosses = Array.isArray(details.losses) && details.losses.length > 0;
  if (!hasKills && !hasLosses && details.killTroops == null && details.lossTroops == null) {
    return { killTroops: null, lossTroops: null };
  }
  return { killTroops: k, lossTroops: l };
}

/**
 * 战报 UI：完整计分步骤（与 calculateBattleScore 一致，非「基础分×回合×攻城」连乘）
 * ③ 惨败保底：仅当 floorScore 实际成为 max(②,③,④) 时显示「惨败保底」，否则「惨败保底（未触发）」。
 * @param {object} details - calculateBattleScore(…).details
 * @param {number} [finalScore] - 存档中的最终分（校验用）
 * @returns {{ lines: Array<{ text: string }> }}
 */
export function buildBattleScoreFormulaLines(details, finalScore) {
  if (!details) return { lines: [] };
  const kill = details.killScore ?? 0;
  const loss = details.lossScore ?? 0;
  const base = details.baseScore ?? kill + loss;
  const turnM = details.turnMultiplier ?? 1;
  const rNum = details.roundNum ?? '—';
  const normalScore = details.normalScore ?? Math.round(base * turnM);
  const rule = details.floorScoreRule ?? 0.3;
  const floorScore = details.floorScore ?? Math.round(kill * rule);
  const comfortRule = details.comfortFloorRule ?? 0.3;
  const comfortFloorScore =
    details.comfortFloorScore ?? (kill === 0 && loss < 0 ? Math.round(Math.abs(loss) * comfortRule) : 0);
  const pre = details.preSiegeScore ?? Math.max(normalScore, floorScore, comfortFloorScore);
  const sm = details.siegeScoreMultiplier ?? 1;
  const calcFinal = Math.round(pre * sm);
  /** 与安慰保底一致：仅当③ 的保底分实际成为 max(②,③,④) 的取值时算「触发」 */
  const floorLabel =
    floorScore > 0 && pre === floorScore ? '惨败保底' : '惨败保底（未触发）';
  const comfortLabel = comfortFloorScore > 0 ? '安慰保底' : '安慰保底（未触发）';
  const lines = [
    { text: `① 歼敌评分 + 战损评分（代数和）= ${kill} + (${loss}) = ${base}` },
    { text: `② 回合倍率：① × ${turnM} = ${normalScore}（第 ${rNum} 回合）` },
    { text: `③ ${floorLabel}：歼敌评分 × ${rule} = ${floorScore}` },
    { text: `④ ${comfortLabel}：当歼敌评分 = 0，战损评分 × ${comfortRule} = ${comfortFloorScore}` },
    { text: `⑤ 取较高：max(②, ③, ④) = ${pre}` },
    { text: `⑥ 最终战报分：⑤ × 攻城积分倍率(${sm}) = ${calcFinal}` },
  ];
  if (comfortFloorScore > 0) {
    lines.push({ text: '（说明：由于歼敌评分为 0，触发安慰保底计分。）' });
  }
  if (finalScore != null && calcFinal !== finalScore) {
    lines.push({ text: `（说明：若与顶部总分差 1，多为历史战报四舍五入顺序；以 ${finalScore} 为准）` });
  }
  return { lines };
}

/** 攻城战：与 NPC 守军区分，驻军编组 / 披挂上阵提高战报积分倍率（攻守双方同倍率） */
export function getSiegeBattleScoreMultiplier(defenderType) {
  if (defenderType === 'player_garrison') return 1.5;
  if (defenderType === 'pvp_online') return 2;
  return 1;
}

/** 驻守方视角：BattleArena 内 faction 仍以攻城方为 player，计算防守方积分时镜像 */
export function mirrorTroopsForDefenderBattleScore(battleTroops) {
  return battleTroops.map((t) => ({
    ...t,
    faction: t.faction === 'player' ? 'enemy' : 'player',
  }));
}
