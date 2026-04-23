/**
 * 战略大地图道路层：栅格集合 → SVG 叠线（与 `road-overlay-demo.html` 双层描边语义一致，坐标为格网 tile 空间）。
 * 寻路/校验：仅以 `roadCells` + `roadConnectivity` 为准；矢量仅为展示。
 */

/** @typedef {{ gx: number, gy: number }} RoadCell */

import { readStrategicCellAnchorId } from './strategicCellAnchorId.js';
import { isBanditMapObjectId } from './smallMapEnemyRoster.js';

/** 四邻接（默认寻路/画线主轴） */
export const ROAD_CONNECTIVITY_4 = '4';
/** 八邻接（含对角线段） */
export const ROAD_CONNECTIVITY_8 = '8';

export function strategicMapObjectIs2x2(objectType) {
  if (!objectType) return false;
  return (
    objectType === 'city_small' ||
    objectType === 'city_medium' ||
    objectType === 'city_major' ||
    objectType === 'gate' ||
    objectType === 'fort'
  );
}

/**
 * 战略对象 2×2 锚点格及其占用的四格 — 道路格不得落入（与 31-5 §11.2 一致）。
 * @param {object[][]|null|undefined} cells
 * @param {number} mapColumns
 * @param {number} mapRows
 * @returns {Set<string>} `"gx,gy"` 键
 */
/**
 * 匪寨在合并图中为 **1×2 或 2×1** 两格（与城类 2×2 区分）；道路寻路不得落入其占格。
 * @param {object[][]} cells
 * @param {number} mapColumns
 * @param {number} mapRows
 * @param {Set<string>} blocked
 */
function addBanditDominoFootprintsToBlocked(cells, mapColumns, mapRows, blocked) {
  const byId = new Map();
  for (let gy = 0; gy < mapRows; gy++) {
    const row = cells[gy];
    if (!row) continue;
    for (let gx = 0; gx < mapColumns; gx++) {
      const cell = row[gx];
      const cid = readStrategicCellAnchorId(cell);
      if (!cid || !isBanditMapObjectId(cid)) continue;
      if (!byId.has(cid)) byId.set(cid, []);
      byId.get(cid).push({ gx, gy });
    }
  }
  for (const [, arr] of byId) {
    if (arr.length !== 2) continue;
    const xs = arr.map((p) => p.gx);
    const ys = arr.map((p) => p.gy);
    const minX = Math.min(xs[0], xs[1]);
    const maxX = Math.max(xs[0], xs[1]);
    const minY = Math.min(ys[0], ys[1]);
    const maxY = Math.max(ys[0], ys[1]);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (w * h !== 2 || (w !== 2 && h !== 2)) continue;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        blocked.add(`${x},${y}`);
      }
    }
  }
}

export function buildStrategicObjectFootprintBlockedSet(cells, mapColumns, mapRows) {
  const blocked = new Set();
  if (!cells?.length) return blocked;
  for (let gy = 0; gy < mapRows; gy++) {
    for (let gx = 0; gx < mapColumns; gx++) {
      const cell = cells[gy]?.[gx];
      if (!readStrategicCellAnchorId(cell) || !strategicMapObjectIs2x2(cell.object)) continue;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const x = gx + dx;
          const y = gy + dy;
          if (x < mapColumns && y < mapRows) blocked.add(`${x},${y}`);
        }
      }
    }
  }
  addBanditDominoFootprintsToBlocked(cells, mapColumns, mapRows, blocked);
  return blocked;
}

/**
 * @param {unknown} raw - API / JSON：`{gx,gy}`、`[gx,gy]` 混排
 * @returns {RoadCell[]}
 */
export function normalizeRoadCellList(raw) {
  if (!raw || !Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    let gx;
    let gy;
    if (Array.isArray(item) && item.length >= 2) {
      gx = Number(item[0]);
      gy = Number(item[1]);
    } else if (item && typeof item === 'object') {
      gx = Number(item.gx ?? item.col);
      gy = Number(item.gy ?? item.row);
    } else {
      continue;
    }
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;
    if (!Number.isInteger(gx) || !Number.isInteger(gy)) continue;
    const k = `${gx},${gy}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ gx, gy });
  }
  return out;
}

const DIRS_4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIRS_8 = [
  ...DIRS_4,
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * 相邻道路格心之间的线段（tile 单位，格心为 (gx+0.5, gy+0.5)），每条无向边只输出一次。
 * @param {RoadCell[]|unknown} roadCells
 * @param {'4'|'8'} connectivity
 * @param {number} mapColumns
 * @param {number} mapRows
 * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
 */
export function buildStrategicRoadOverlaySegments(roadCells, connectivity, mapColumns, mapRows) {
  const list = Array.isArray(roadCells) ? normalizeRoadCellList(roadCells) : [];
  const set = new Set(list.map((c) => `${c.gx},${c.gy}`));
  const dirs = connectivity === ROAD_CONNECTIVITY_8 ? DIRS_8 : DIRS_4;
  const segments = [];

  for (const key of set) {
    const [gxs, gys] = key.split(',');
    const gx = Number(gxs);
    const gy = Number(gys);
    for (const [dx, dy] of dirs) {
      const ngx = gx + dx;
      const ngy = gy + dy;
      if (ngx < 0 || ngy < 0 || ngx >= mapColumns || ngy >= mapRows) continue;
      if (!set.has(`${ngx},${ngy}`)) continue;
      if (gx < ngx || (gx === ngx && gy < ngy)) {
        segments.push({
          x1: gx + 0.5,
          y1: gy + 0.5,
          x2: ngx + 0.5,
          y2: ngy + 0.5,
        });
      }
    }
  }
  return segments;
}

/**
 * 双层 path 共用同一 `d`（单位：tile，与 viewBox `0 0 mapColumns mapRows` 一致）。
 * @param {RoadCell[]|unknown} roadCells
 * @param {'4'|'8'} connectivity
 * @param {number} mapColumns
 * @param {number} mapRows
 * @returns {string}
 */
export function buildStrategicRoadOverlayPathD(roadCells, connectivity, mapColumns, mapRows) {
  const segments = buildStrategicRoadOverlaySegments(
    roadCells,
    connectivity,
    mapColumns,
    mapRows,
  );
  if (!segments.length) return '';
  return segments.map((s) => `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`).join(' ');
}
