/**
 * 官职 → 属性重随稀有度（编组官职槽 / playerRerollService 共用）
 * @see docs/00/10-core-system/12-1-POSITION_SYSTEM.md §属性提升机制
 */

'use strict';

const DEFAULT_DASIKONG_POSITION_ID = 'san_1_position_dasikong';

/** 大司空任命决选：已任 Lv≤2 高官（除大司空外）不参与 */
const DASIKONG_APPOINTMENT_EXCLUDE_MAX_LEVEL = 2;

/** 大司空任职期间手动属性重随固定 legendary（非 core） */
const DASIKONG_REROLL_RARITY = 'legendary';

/**
 * @param {number|null|undefined} positionLevel
 * @returns {'common'|'rare'|'epic'|'legendary'|'core'}
 */
function getPositionRarityFromLevel(positionLevel) {
  const level = positionLevel ?? 8;
  if (level <= 3) return 'core';
  if (level === 4) return 'legendary';
  if (level === 5) return 'epic';
  if (level <= 7) return 'rare';
  return 'common';
}

/**
 * @param {{ positionLevel?: number|null, currentPositionId?: string|null, dasikongPositionId?: string }} opts
 */
function getRerollRarityForPlayer(opts = {}) {
  const dasikongId = String(opts.dasikongPositionId || DEFAULT_DASIKONG_POSITION_ID).trim();
  const currentId = opts.currentPositionId != null ? String(opts.currentPositionId).trim() : '';
  if (currentId && currentId === dasikongId) {
    return DASIKONG_REROLL_RARITY;
  }
  return getPositionRarityFromLevel(opts.positionLevel);
}

module.exports = {
  DEFAULT_DASIKONG_POSITION_ID,
  DASIKONG_APPOINTMENT_EXCLUDE_MAX_LEVEL,
  DASIKONG_REROLL_RARITY,
  getPositionRarityFromLevel,
  getRerollRarityForPlayer,
};
