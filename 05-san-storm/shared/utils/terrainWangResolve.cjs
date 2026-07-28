/**
 * 战术底图 Wang 角点选瓦（mapGenerator_v2 · P0）
 * 须与 terrainWangResolve.js 同步。
 */

const {
  TERRAIN_OCC,
  WANG_CORNER,
  WANG_LAYER_PAINT_ORDER,
  WANG_TERRAIN_KINDS,
  WANG_VOID_TILE_REL,
  wangTileRelPathForMask,
} = require('./terrainWangTables.cjs');

function cellIsKind(occGrid, x, y, kind) {
  if (!Array.isArray(occGrid) || occGrid.length === 0) return false;
  if (y < 0 || x < 0 || y >= occGrid.length) return false;
  const row = occGrid[y];
  if (!Array.isArray(row) || x >= row.length) return false;
  return row[x] === kind;
}

function computeWangCornerMask(occGrid, x, y, kind) {
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

function resolveWangTileForKind(occGrid, x, y, kind) {
  const mask = computeWangCornerMask(occGrid, x, y, kind);
  if (mask === 0) {
    return { mask: 0, tileRel: WANG_VOID_TILE_REL, kind: null };
  }
  return { mask, tileRel: wangTileRelPathForMask(kind, mask), kind };
}

function resolveWangBaseTile(occGrid, x, y, layerOrder = WANG_LAYER_PAINT_ORDER) {
  let best = { mask: 0, tileRel: WANG_VOID_TILE_REL, kind: null };
  for (const kind of layerOrder) {
    if (!WANG_TERRAIN_KINDS.includes(kind)) continue;
    const next = resolveWangTileForKind(occGrid, x, y, kind);
    if (next.mask !== 0) best = next;
  }
  return best;
}

function resolveWangBaseTileGrid(occGrid, opts = {}) {
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
  const tileRel = [];
  const masks = [];
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

module.exports = {
  TERRAIN_OCC,
  WANG_VOID_TILE_REL,
  computeWangCornerMask,
  resolveWangTileForKind,
  resolveWangBaseTile,
  resolveWangBaseTileGrid,
};
