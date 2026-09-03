/**
 * 官职 → 属性重随稀有度 — 游戏前端 ESM 入口。
 * 算法须与 `shared/utils/positionRerollRarity.cjs` 一致；改逻辑时请同步两处。
 * （Vite 不宜 `import` 共享 `.cjs` 的命名导出，见 `positionCombatBonuses.js` 同模式。）
 */

const DEFAULT_DASIKONG_POSITION_ID = 'san_1_position_dasikong';

/** 大司空任职期间手动属性重随固定 legendary（非 core） */
const DASIKONG_REROLL_RARITY = 'legendary';

/**
 * @param {number|null|undefined} positionLevel
 * @returns {'common'|'rare'|'epic'|'legendary'|'core'}
 */
export function getPositionRarityFromLevel(positionLevel) {
  const level = positionLevel ?? 8;
  if (level <= 3) return 'core';
  if (level === 4) return 'legendary';
  if (level === 5) return 'epic';
  if (level <= 7) return 'rare';
  return 'common';
}

/**
 * @param {{ positionLevel?: number|null, currentPositionId?: string|null, dasikongPositionId?: string }} opts
 * @returns {'common'|'rare'|'epic'|'legendary'|'core'}
 */
export function getRerollRarityForPlayer(opts = {}) {
  const dasikongId = String(opts.dasikongPositionId || DEFAULT_DASIKONG_POSITION_ID).trim();
  const currentId = opts.currentPositionId != null ? String(opts.currentPositionId).trim() : '';
  if (currentId && currentId === dasikongId) {
    return DASIKONG_REROLL_RARITY;
  }
  return getPositionRarityFromLevel(opts.positionLevel);
}

/** @deprecated 旧组件名兼容；与 getRerollRarityForPlayer 同义 */
export const getRerollRarityForTier = getRerollRarityForPlayer;
