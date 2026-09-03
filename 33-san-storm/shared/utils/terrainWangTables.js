/**
 * 战术底图 Wang 方位表（mapGenerator_v2 · P0）
 * 须与 terrainWangTables.cjs 同步。
 *
 * 角点 mask（图像坐标 y 向下）：NW=1 NE=2 SW=4 SE=8。
 * 三系 grass/water/lava 共用同一 row/col 表；mask 0 → void_fill（无 *-0-3 文件）。
 *
 * @see docs/01-strategic-world/30-frontend/31-7-MAP_GENERATOR_V2_IMPLEMENTATION.md
 */

/** @typedef {'void'|'grass'|'water'|'lava'} TerrainOccupancy */

export const TERRAIN_OCC = Object.freeze({
  VOID: 'void',
  GRASS: 'grass',
  WATER: 'water',
  LAVA: 'lava',
});

/** 支持 Wang 方位包的地形系（不含 void） */
export const WANG_TERRAIN_KINDS = Object.freeze(['grass', 'water', 'lava']);

/** 角点 bit */
export const WANG_CORNER = Object.freeze({
  NW: 1,
  NE: 2,
  SW: 4,
  SE: 8,
});

/** 素材相对 `assets/san_1_map/`；单瓦像素边长 */
export const WANG_TILE_DIR = 'tile_1_bg';
export const WANG_TILE_PX = 64;
export const WANG_VOID_TILE_REL = `${WANG_TILE_DIR}/void_fill.png`;

/**
 * mask 1..15 → 文件名中的 row-col（三系相同）。
 * 由 docs/tools/map/scripts/classify-wang-tiles.py 实测编目。
 */
export const WANG_MASK_TO_RC = Object.freeze({
  1: Object.freeze({ row: 3, col: 3 }),
  2: Object.freeze({ row: 0, col: 2 }),
  3: Object.freeze({ row: 1, col: 2 }),
  4: Object.freeze({ row: 0, col: 0 }),
  5: Object.freeze({ row: 3, col: 2 }),
  6: Object.freeze({ row: 2, col: 3 }),
  7: Object.freeze({ row: 3, col: 1 }),
  8: Object.freeze({ row: 1, col: 3 }),
  9: Object.freeze({ row: 0, col: 1 }),
  10: Object.freeze({ row: 1, col: 0 }),
  11: Object.freeze({ row: 2, col: 2 }),
  12: Object.freeze({ row: 3, col: 0 }),
  13: Object.freeze({ row: 2, col: 0 }),
  14: Object.freeze({ row: 1, col: 1 }),
  15: Object.freeze({ row: 2, col: 1 }),
});

/** 叠层优先级：后者覆盖前者（火缘压水缘压草缘） */
export const WANG_LAYER_PAINT_ORDER = Object.freeze(['grass', 'water', 'lava']);

/**
 * @param {string} kind
 * @param {number} row
 * @param {number} col
 * @returns {string} 相对 `assets/san_1_map/` 的路径
 */
export function wangTerrainTileRelPath(kind, row, col) {
  return `${WANG_TILE_DIR}/${kind}-${row}-${col}.png`;
}

/**
 * @param {number} mask 0..15
 * @param {string} kind grass|water|lava
 * @returns {string}
 */
export function wangTileRelPathForMask(kind, mask) {
  const m = mask | 0;
  if (m === 0) return WANG_VOID_TILE_REL;
  const rc = WANG_MASK_TO_RC[m];
  if (!rc) {
    throw new Error(`[terrainWang] unknown corner mask ${m} for kind=${kind}`);
  }
  if (!WANG_TERRAIN_KINDS.includes(kind)) {
    throw new Error(`[terrainWang] invalid kind=${kind}`);
  }
  return wangTerrainTileRelPath(kind, rc.row, rc.col);
}

/** 自检：表是否覆盖 1..15 */
export function assertWangMaskTableComplete() {
  for (let m = 1; m <= 15; m += 1) {
    if (!WANG_MASK_TO_RC[m]) {
      throw new Error(`[terrainWang] missing WANG_MASK_TO_RC[${m}]`);
    }
  }
}
