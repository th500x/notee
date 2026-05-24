/**
 * 三公府 · 朝政 / 军团 品阶门闸（`config_positions.position_level`：数字越小品阶越高）
 * @see docs/10-core-system/13-1-CITY_SYSTEM.md §8.4.3
 */

'use strict';

/** 「一阶官职以上」= 品阶 Lv ≤ 1（含君主 Lv.0、一品 Lv.1） */
const CHAOZHENG_MAX_POSITION_LEVEL = 1;

/** 「三阶官职以上」= 品阶 Lv ≤ 3（四方将军及以上） */
const LEGION_MAX_POSITION_LEVEL = 3;

/**
 * @param {number|null|undefined} positionLevel
 * @param {number} maxLevelInclusive
 */
function isPositionLevelWithinSanGongGate(positionLevel, maxLevelInclusive) {
  const lv = Number(positionLevel);
  return Number.isFinite(lv) && lv <= maxLevelInclusive;
}

function assertChaoZhengPositionLevel(positionLevel) {
  if (!isPositionLevelWithinSanGongGate(positionLevel, CHAOZHENG_MAX_POSITION_LEVEL)) {
    const err = new Error('需一阶及以上官职（朝政品阶 Lv≤1）方可操作');
    err.statusCode = 400;
    throw err;
  }
}

module.exports = {
  CHAOZHENG_MAX_POSITION_LEVEL,
  LEGION_MAX_POSITION_LEVEL,
  isPositionLevelWithinSanGongGate,
  assertChaoZhengPositionLevel,
};
