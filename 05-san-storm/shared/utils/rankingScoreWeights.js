/**
 * ESM 镜像 · 须与 rankingScoreWeights.cjs 保持同步（32-3 §4）
 * @module shared/utils/rankingScoreWeights
 */

export const DEFAULT_SCORE_WEIGHTS = Object.freeze({
  battleScore: 1,
  events: 120,
  reputation: 60,
  contribution: 60,
});

/**
 * @param {{ battleScore?: number, events?: number, reputation?: number, contribution?: number }|null|undefined} raw
 * @returns {{ battle: number, events: number, reputation: number, contribution: number }}
 */
export function normalizeSqlWeights(raw) {
  const w = raw && typeof raw === 'object' ? raw : DEFAULT_SCORE_WEIGHTS;
  return {
    battle: Number(w.battleScore ?? DEFAULT_SCORE_WEIGHTS.battleScore),
    events: Number(w.events ?? DEFAULT_SCORE_WEIGHTS.events),
    reputation: Number(w.reputation ?? DEFAULT_SCORE_WEIGHTS.reputation),
    contribution: Number(w.contribution ?? DEFAULT_SCORE_WEIGHTS.contribution),
  };
}
