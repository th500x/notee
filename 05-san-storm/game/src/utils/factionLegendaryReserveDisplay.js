/**
 * 势力传奇储备 · 前端展示用 ESM（算法与 shared/utils/factionLegendaryReserve.cjs 一致）
 * Vite 不宜直接 import 共享 .cjs 命名导出，见 positionRerollRarity.js 同模式。
 */

/** 满储备（≥20）时的自然传奇概率 */
export const BASE_LEGENDARY_PROB = 0.05;

/** 概率计算用的储备上限（实际余额可无限累积） */
export const LEGENDARY_QUOTA_PROB_CAP = 20;

/** @deprecated 兼容旧 import · BASE_RESERVE_VAL */
export const BASE_RESERVE_VAL = LEGENDARY_QUOTA_PROB_CAP;

/** @deprecated 兼容旧 import · BASE_RESERVE_MAX（与 PROB_CAP 同义：满 20 张恢复 5% 自然概率） */
export const BASE_RESERVE_MAX = LEGENDARY_QUOTA_PROB_CAP;

/** @param {number} prob 0～1 */
export function formatLegendaryProbPercent(prob) {
  const pct = Math.max(0, Number(prob) || 0) * 100;
  if (pct >= 10) return `${pct.toFixed(1).replace(/\.0$/, '')}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  return '0%';
}

/**
 * @param {number} legendaryQuota
 * @returns {{ legendary: number, epic: number, rare: number, common: number }}
 */
export function computeLegendaryDrawProbabilities(legendaryQuota) {
  const q = Math.max(0, Math.floor(Number(legendaryQuota) || 0));
  const effective = Math.min(q, LEGENDARY_QUOTA_PROB_CAP);
  const pLegendary = BASE_LEGENDARY_PROB * (effective / LEGENDARY_QUOTA_PROB_CAP);
  const pEpic = Math.max(0, 0.15 - pLegendary);
  return { legendary: pLegendary, epic: pEpic, rare: 0.3, common: 0.55 };
}
