/**
 * 势力传奇储备 · 日恢复与卡池动态概率（13-3）
 * @module shared/utils/factionLegendaryReserve
 */

/** 满储备（≥20）时的自然传奇概率 */
const BASE_LEGENDARY_PROB = 0.05;

/** 传奇+史诗合计概率（5%+10%） */
const COMBINED_EPIC_LEGENDARY_PROB = 0.15;

/** 概率计算用的储备上限（实际余额可无限累积） */
const LEGENDARY_QUOTA_PROB_CAP = 20;

const RARE_PROB = 0.3;
const COMMON_PROB = 0.55;

/** 五维标量 → 日恢复张数（部队=军事/5，将领=文化/5） */
const LEGENDARY_RECOVERY_DIVISOR = 5;

/**
 * @param {number} legendaryQuota 当前势力传奇储备张数
 * @returns {{ legendary: number, epic: number, rare: number, common: number }}
 */
function computeLegendaryDrawProbabilities(legendaryQuota) {
  const q = Math.max(0, Math.floor(Number(legendaryQuota) || 0));
  const effective = Math.min(q, LEGENDARY_QUOTA_PROB_CAP);
  const pLegendary = BASE_LEGENDARY_PROB * (effective / LEGENDARY_QUOTA_PROB_CAP);
  const pEpic = Math.max(0, COMBINED_EPIC_LEGENDARY_PROB - pLegendary);
  return {
    legendary: pLegendary,
    epic: pEpic,
    rare: RARE_PROB,
    common: COMMON_PROB,
  };
}

/**
 * @param {number} military 势力军事标量
 * @param {number} culture 势力文化标量
 * @returns {{ troop: number, character: number }}
 */
function computeDailyLegendaryRecovery(military, culture) {
  const m = Math.max(0, Math.floor(Number(military) || 0));
  const c = Math.max(0, Math.floor(Number(culture) || 0));
  return {
    troop: Math.floor(m / LEGENDARY_RECOVERY_DIVISOR),
    character: Math.floor(c / LEGENDARY_RECOVERY_DIVISOR),
  };
}

/** @param {number} prob 0～1 */
function formatLegendaryProbPercent(prob) {
  const pct = Math.max(0, Number(prob) || 0) * 100;
  if (pct >= 10) return `${pct.toFixed(1).replace(/\.0$/, '')}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  return '0%';
}

/**
 * 保底计数溢出：成功发出传奇后保留超出阈值的部分（如 51→1）
 * @param {number} pityBeforeDraw 本张抽卡前的 pity 计数
 * @param {number} pityThreshold 保底阈值（默认 50）
 */
function computePityAfterLegendaryDelivered(pityBeforeDraw, pityThreshold = 50) {
  const before = Math.max(0, Math.floor(Number(pityBeforeDraw) || 0));
  const th = Math.max(1, Math.floor(Number(pityThreshold) || 50));
  return Math.max(0, before - th);
}

module.exports = {
  BASE_LEGENDARY_PROB,
  COMBINED_EPIC_LEGENDARY_PROB,
  LEGENDARY_QUOTA_PROB_CAP,
  LEGENDARY_RECOVERY_DIVISOR,
  computeLegendaryDrawProbabilities,
  computeDailyLegendaryRecovery,
  formatLegendaryProbPercent,
  computePityAfterLegendaryDelivered,
};
