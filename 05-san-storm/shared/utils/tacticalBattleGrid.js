/**
 * 回合制战斗格网常量（小型随机战术图默认 8×10）。
 * 地图生成器（generateSmallMap）、事件/攻城战斗壳层沿用此尺寸。
 *
 * 寻路、AI、回合引擎以 `mapResult.terrain` 的实际宽高为准（见 `getMapTerrainDimensions`），
 * 战役整图 16×20 与事件 8×10 共用同一套逻辑，不再在战役路径做局部贴片坐标。
 */

export const TACTICAL_GRID_WIDTH = 8;
export const TACTICAL_GRID_HEIGHT = 10;

/** 行分区：北部署 / 交战 / 南部署（行索引自 0 起）— 仅适用于高为 10 的战术图 */
export const ZONE = {
  deployA: [0, 1, 2],
  combat: [3, 4, 5, 6],
  deployB: [7, 8, 9],
};

/**
 * @param {object|null|undefined} mapResult
 * @returns {{ w: number, h: number }}
 */
export function getMapTerrainDimensions(mapResult) {
  const terrain = mapResult?.terrain;
  const h = terrain?.length;
  const w = terrain?.[0]?.length;
  if (!h || !w) {
    return { w: TACTICAL_GRID_WIDTH, h: TACTICAL_GRID_HEIGHT };
  }
  return { w, h };
}

/** 南三行部署带：与 10 行战术图时 ZONE.deployB 一致；更高地图为末三行 */
export function getSouthDeployRowRange(mapResult) {
  const { h } = getMapTerrainDimensions(mapResult);
  if (h < 3) return [];
  return [h - 3, h - 2, h - 1];
}

export function isInMapGrid(row, col, mapResult) {
  const { w, h } = getMapTerrainDimensions(mapResult);
  return row >= 0 && row < h && col >= 0 && col < w;
}

export function mapTileIndex(row, col, mapResult) {
  const { w } = getMapTerrainDimensions(mapResult);
  return row * w + col;
}

export function tacticalTileIndex(row, col) {
  return row * TACTICAL_GRID_WIDTH + col;
}

export function isInTacticalGrid(row, col) {
  return (
    row >= 0 &&
    row < TACTICAL_GRID_HEIGHT &&
    col >= 0 &&
    col < TACTICAL_GRID_WIDTH
  );
}
