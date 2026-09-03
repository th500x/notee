/**
 * 战术底图 Wang 角点选瓦（mapGenerator_v2 · P0）
 * 须与 terrainWangResolve.cjs 同步。
 *
 * 格 (x,y) 的四角取自 occupancy 2×2：
 *   NW=(x-1,y-1) NE=(x,y-1) SW=(x-1,y) SE=(x,y)
 * 越界视为非该 kind。mask=0 → void_fill。
 *
 * @see docs/01-strategic-world/30-frontend/31-7-MAP_GENERATOR_V2_IMPLEMENTATION.md
 */

import {
  TERRAIN_OCC,
  WANG_CORNER,
  WANG_LAYER_PAINT_ORDER,
  WANG_TERRAIN_KINDS,
  WANG_VOID_TILE_REL,
  wangTileRelPathForMask,
} from './terrainWangTables.js';

/**
 * @param {string[][]} occGrid  occGrid[y][x]
 * @param {number} x
 * @param {number} y
 * @param {string} kind
 * @returns {boolean}
 */
function cellIsKind(occGrid, x, y, kind) {
  if (!Array.isArray(occGrid) || occGrid.length === 0) return false;
  if (y < 0 || x < 0 || y >= occGrid.length) return false;
  const row = occGrid[y];
  if (!Array.isArray(row) || x >= row.length) return false;
  return row[x] === kind;
}

/**
 * @param {string[][]} occGrid
 * @param {number} x 列
 * @param {number} y 行
 * @param {string} kind grass|water|lava
 * @returns {number} 0..15
 */
export function computeWangCornerMask(occGrid, x, y, kind) {
  if (!WANG_TERRAIN_KINDS.includes(kind)) {
    throw new Error(`[terrainWangResolve] invalid kind=${kind}`);
  }
  let mask = 0;
  if (cellIsKind(occGrid, x - 1, y - 1, kind)) mask |= WANG_CORNER.NW;
  if (cellIsKind(occGrid, x, y - 1, kind)) mask |= WANG_CORNER.NE;
  if (cellIsKind(occGrid, x - 1, y, kind)) mask |= WANG_CORNER.SW;
  if (cellIsKind(occGrid, x, y, kind)) mask |= WANG_CORNER.SE;
  return mask;
}

/**
 * 单地形系选瓦（相对 assets/san_1_map/）
 * @param {string[][]} occGrid
 * @param {number} x
 * @param {number} y
 * @param {string} kind
 * @returns {{ mask: number, tileRel: string, kind: string|null }}
 */
export function resolveWangTileForKind(occGrid, x, y, kind) {
  const mask = computeWangCornerMask(occGrid, x, y, kind);
  if (mask === 0) {
    return { mask: 0, tileRel: WANG_VOID_TILE_REL, kind: null };
  }
  return { mask, tileRel: wangTileRelPathForMask(kind, mask), kind };
}

/**
 * 多系叠层：按 WANG_LAYER_PAINT_ORDER，后者非空 mask 覆盖前者。
 * 全空则 void_fill。
 * @param {string[][]} occGrid
 * @param {number} x
 * @param {number} y
 * @param {readonly string[]} [layerOrder]
 * @returns {{ mask: number, tileRel: string, kind: string|null }}
 */
export function resolveWangBaseTile(occGrid, x, y, layerOrder = WANG_LAYER_PAINT_ORDER) {
  let best = { mask: 0, tileRel: WANG_VOID_TILE_REL, kind: null };
  for (const kind of layerOrder) {
    if (!WANG_TERRAIN_KINDS.includes(kind)) continue;
    const next = resolveWangTileForKind(occGrid, x, y, kind);
    if (next.mask !== 0) best = next;
  }
  return best;
}

/**
 * 整图解析底瓦路径（尺寸 = occupancy 实际行列，不写死）
 * @param {string[][]} occGrid
 * @param {{ layerOrder?: readonly string[] }} [opts]
 * @returns {{ width: number, height: number, tileRel: string[][], masks: number[][], kinds: (string|null)[][] }}
 */
export function resolveWangBaseTileGrid(occGrid, opts = {}) {
  if (!Array.isArray(occGrid) || occGrid.length === 0) {
    throw new Error('[terrainWangResolve] occGrid empty');
  }
  const height = occGrid.length;
  const width = occGrid[0]?.length ?? 0;
  if (width <= 0) throw new Error('[terrainWangResolve] occGrid width 0');
  for (let y = 0; y < height; y += 1) {
    if (!Array.isArray(occGrid[y]) || occGrid[y].length !== width) {
      throw new Error(`[terrainWangResolve] ragged row ${y}`);
    }
  }
  const layerOrder = opts.layerOrder ?? WANG_LAYER_PAINT_ORDER;
  /** @type {string[][]} */
  const tileRel = [];
  /** @type {number[][]} */
  const masks = [];
  /** @type {(string|null)[][]} */
  const kinds = [];
  for (let y = 0; y < height; y += 1) {
    tileRel[y] = [];
    masks[y] = [];
    kinds[y] = [];
    for (let x = 0; x < width; x += 1) {
      const cell = resolveWangBaseTile(occGrid, x, y, layerOrder);
      tileRel[y][x] = cell.tileRel;
      masks[y][x] = cell.mask;
      kinds[y][x] = cell.kind;
    }
  }
  return { width, height, tileRel, masks, kinds };
}

export { TERRAIN_OCC, WANG_VOID_TILE_REL };
