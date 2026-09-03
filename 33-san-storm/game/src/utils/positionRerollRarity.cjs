/**
 * Vite 开发态兼容：部分旧 HMR 缓存仍从本路径 import `getRerollRarityForTier`。
 * 逻辑与 `shared/utils/positionRerollRarity.cjs` 一致；新代码请用 `@/utils/positionRerollRarity.js`。
 */
'use strict';

const shared = require('../../../shared/utils/positionRerollRarity.cjs');

module.exports = {
  DEFAULT_DASIKONG_POSITION_ID: shared.DEFAULT_DASIKONG_POSITION_ID,
  DASIKONG_APPOINTMENT_EXCLUDE_MAX_LEVEL: shared.DASIKONG_APPOINTMENT_EXCLUDE_MAX_LEVEL,
  DASIKONG_REROLL_RARITY: shared.DASIKONG_REROLL_RARITY,
  getPositionRarityFromLevel: shared.getPositionRarityFromLevel,
  getRerollRarityForPlayer: shared.getRerollRarityForPlayer,
  getRerollRarityForTier: shared.getRerollRarityForPlayer,
};
