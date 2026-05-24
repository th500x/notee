/**
 * 三公府 · 朝政 / 军团 品阶门闸 — 游戏前端 ESM 入口。
 * 须与 `shared/utils/sanGongPositionGates.cjs` 一致。
 */

/** 「一阶官职以上」= 品阶 Lv ≤ 1 */
export const CHAOZHENG_MAX_POSITION_LEVEL = 1;

/** 「三阶官职以上」= 品阶 Lv ≤ 3 */
export const LEGION_MAX_POSITION_LEVEL = 3;

/**
 * @param {number|null|undefined} positionLevel
 * @param {number} maxLevelInclusive
 */
export function isPositionLevelWithinSanGongGate(positionLevel, maxLevelInclusive) {
  const lv = Number(positionLevel);
  return Number.isFinite(lv) && lv <= maxLevelInclusive;
}

export function isChaoZhengUnlocked(positionLevel) {
  return isPositionLevelWithinSanGongGate(positionLevel, CHAOZHENG_MAX_POSITION_LEVEL);
}

export function isLegionUnlocked(positionLevel) {
  return isPositionLevelWithinSanGongGate(positionLevel, LEGION_MAX_POSITION_LEVEL);
}
