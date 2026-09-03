/**
 * 手动战斗高亮：纯数据，由小型图 / 大型图各自渲染（不操作 DOM）。
 *
 * @typedef {{ y: number, x: number }} TacticalCell
 * @typedef {{ y: number, x: number, cost?: number }} MoveCell
 * @typedef {{
 *   active: TacticalCell[],
 *   move: MoveCell[],
 *   atk: TacticalCell[],
 *   heal?: TacticalCell[],
 *   skillPreview?: TacticalCell[],
 * }} ManualHighlightModel
 */

/** @returns {ManualHighlightModel | null} */
export function emptyManualHighlightModel() {
  return null;
}

/**
 * @param {number} y
 * @param {number} x
 * @param {ManualHighlightModel | null} model
 * @returns {{ kind: 'active'|'move'|'skillPreview'|'heal'|'atk'|null, cost?: number }}
 */
export function manualHighlightForTacticalCell(y, x, model) {
  if (!model) return { kind: null };
  if (model.active?.some((p) => p.y === y && p.x === x)) return { kind: 'active' };
  const mv = model.move?.find((p) => p.y === y && p.x === x);
  if (mv) return { kind: 'move', cost: mv.cost };
  if (model.skillPreview?.some((p) => p.y === y && p.x === x)) return { kind: 'skillPreview' };
  if (model.heal?.some((p) => p.y === y && p.x === x)) return { kind: 'heal' };
  if (model.atk?.some((p) => p.y === y && p.x === x)) return { kind: 'atk' };
  return { kind: null };
}
