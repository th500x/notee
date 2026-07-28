/**
 * 战术底图 Wang 方位表（mapGenerator_v2 · P0）
 * 须与 terrainWangTables.js 同步。
 */

const TERRAIN_OCC = Object.freeze({
  VOID: 'void',
  GRASS: 'grass',
  WATER: 'water',
  LAVA: 'lava',
});

const WANG_TERRAIN_KINDS = Object.freeze(['grass', 'water', 'lava']);

const WANG_CORNER = Object.freeze({
  NW: 1,
  NE: 2,
  SW: 4,
  SE: 8,
});

const WANG_TILE_DIR = 'tile_1_bg';
const WANG_TILE_PX = 64;
const WANG_VOID_TILE_REL = `${WANG_TILE_DIR}/void_fill.png`;

const WANG_MASK_TO_RC = Object.freeze({
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

const WANG_LAYER_PAINT_ORDER = Object.freeze(['grass', 'water', 'lava']);

function wangTerrainTileRelPath(kind, row, col) {
  return `${WANG_TILE_DIR}/${kind}-${row}-${col}.png`;
}

function wangTileRelPathForMask(kind, mask) {
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

function assertWangMaskTableComplete() {
  for (let m = 1; m <= 15; m += 1) {
    if (!WANG_MASK_TO_RC[m]) {
      throw new Error(`[terrainWang] missing WANG_MASK_TO_RC[${m}]`);
    }
  }
}

module.exports = {
  TERRAIN_OCC,
  WANG_TERRAIN_KINDS,
  WANG_CORNER,
  WANG_TILE_DIR,
  WANG_TILE_PX,
  WANG_VOID_TILE_REL,
  WANG_MASK_TO_RC,
  WANG_LAYER_PAINT_ORDER,
  wangTerrainTileRelPath,
  wangTileRelPathForMask,
  assertWangMaskTableComplete,
};
