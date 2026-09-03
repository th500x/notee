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
    objectType === 'city_gate'
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

/**
 * 道路涂抹禁区：城关据点 2×2 与匪寨骨牌 2 格（并集用于判「能否画路」）。
 * @returns {{ strategic: Set<string>, bandit: Set<string>, combined: Set<string> }} 键均为 `"gx,gy"`
 */
/**
 * 城/关 2×2 仅左上角为锚点（工坊/Meowa 常在四格都写 cityId/object，不可每格再当锚点）。
 * @param {object[][]|null|undefined} cells
 * @param {number} gx
 * @param {number} gy
 * @returns {boolean}
 */
export function isStrategic2x2FootprintAnchor(cells, gx, gy) {
  const cell = cells[gy]?.[gx];
  const id = readStrategicCellAnchorId(cell);
  if (!id || !strategicMapObjectIs2x2(cell.object)) return false;
  if (gx > 0) {
    const left = cells[gy]?.[gx - 1];
    if (readStrategicCellAnchorId(left) === id) return false;
  }
  if (gy > 0) {
    const up = cells[gy - 1]?.[gx];
    if (readStrategicCellAnchorId(up) === id) return false;
  }
  return true;
}

export function buildStrategicRoadPaintBlockedLayers(cells, mapColumns, mapRows) {
  const strategic = new Set();
  const bandit = new Set();
  const empty = { strategic, bandit, combined: new Set() };
  if (!cells?.length) return empty;
  for (let gy = 0; gy < mapRows; gy++) {
    for (let gx = 0; gx < mapColumns; gx++) {
      if (!isStrategic2x2FootprintAnchor(cells, gx, gy)) continue;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const x = gx + dx;
          const y = gy + dy;
          if (x < mapColumns && y < mapRows) strategic.add(`${x},${y}`);
        }
      }
    }
  }
  addBanditDominoFootprintsToBlocked(cells, mapColumns, mapRows, bandit);
  const combined = new Set(strategic);
  for (const k of bandit) combined.add(k);
  return { strategic, bandit, combined };
}

export function buildStrategicObjectFootprintBlockedSet(cells, mapColumns, mapRows) {
  const { combined } = buildStrategicRoadPaintBlockedLayers(cells, mapColumns, mapRows);
  return combined;
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

/**
 * 道路邻边中，两端格 `adminJunAt(gx,gy)` 不同的线段（用于小地图郡界土黄叠线）。
 * 与 `buildStrategicRoadOverlaySegments` 同一去重规则（无向边只保留一次）。
 *
 * @param {RoadCell[]|unknown} roadCells
 * @param {'4'|'8'} connectivity
 * @param {number} mapColumns
 * @param {number} mapRows
 * @param {(gx: number, gy: number) => string} adminJunAt
 * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
 */
export function buildStrategicRoadAdminJurisdictionBoundarySegments(
  roadCells,
  connectivity,
  mapColumns,
  mapRows,
  adminJunAt,
) {
  if (typeof adminJunAt !== 'function') return [];
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
      if (adminJunAt(gx, gy) === adminJunAt(ngx, ngy)) continue;
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

function roadCenterNodeKey(x, y) {
  const a = Math.round(Number(x) * 2);
  const b = Math.round(Number(y) * 2);
  return `${a},${b}`;
}

function roadCenterCoordFromNodeKey(k) {
  const [a, b] = String(k).split(',').map(Number);
  return { x: a / 2, y: b / 2 };
}

function roadCenterEdgeMultiKey(k1, k2) {
  return k1 < k2 ? `${k1}~${k2}` : `${k2}~${k1}`;
}

function roadCenterEdgeCount(multi, k1, k2) {
  return multi.get(roadCenterEdgeMultiKey(k1, k2)) || 0;
}

function roadCenterTakeEdge(multi, k1, k2) {
  const ek = roadCenterEdgeMultiKey(k1, k2);
  const c = multi.get(ek) || 0;
  if (c <= 0) return false;
  multi.set(ek, c - 1);
  return true;
}

/**
 * 将格心线段（道路邻接等）按共端点连成折线，供郡界叠线一笔画式描边（避免「一小截一小截」的 M L M L）。
 * @param {{ x1: number, y1: number, x2: number, y2: number }[]} segments
 * @returns {Array<Array<{ x: number, y: number }>>}
 */
export function mergeRoadCenterSegmentsToPolylines(segments) {
  if (!Array.isArray(segments) || !segments.length) return [];
  const multi = new Map();
  const adj = new Map();

  for (const s of segments) {
    const k1 = roadCenterNodeKey(s.x1, s.y1);
    const k2 = roadCenterNodeKey(s.x2, s.y2);
    const ek = roadCenterEdgeMultiKey(k1, k2);
    multi.set(ek, (multi.get(ek) || 0) + 1);
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    if (!adj.get(k1).includes(k2)) adj.get(k1).push(k2);
    if (!adj.get(k2).includes(k1)) adj.get(k2).push(k1);
  }

  const pickNext = (prev, cur) => {
    for (const nb of adj.get(cur) || []) {
      if (nb === prev) continue;
      if (roadCenterEdgeCount(multi, cur, nb) > 0) return nb;
    }
    return null;
  };

  const dedupeConsecutive = (pts) => {
    const out = [];
    for (const p of pts) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.x - p.x) < 1e-6 && Math.abs(last.y - p.y) < 1e-6) continue;
      out.push(p);
    }
    if (out.length >= 2) {
      const a = out[0];
      const b = out[out.length - 1];
      if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) out.pop();
    }
    return out;
  };

  const polylines = [];
  while (true) {
    let seedEk = null;
    for (const [ek, c] of multi) {
      if (c > 0) {
        seedEk = ek;
        break;
      }
    }
    if (!seedEk) break;
    const [ka, kb] = seedEk.split('~');
    roadCenterTakeEdge(multi, ka, kb);
    const pt = roadCenterCoordFromNodeKey;
    const pts = [pt(ka), pt(kb)];
    let prev = ka;
    let cur = kb;
    while (true) {
      const nxt = pickNext(prev, cur);
      if (!nxt) break;
      roadCenterTakeEdge(multi, cur, nxt);
      pts.push(pt(nxt));
      prev = cur;
      cur = nxt;
    }
    prev = kb;
    cur = ka;
    const prefix = [];
    while (true) {
      const nxt = pickNext(prev, cur);
      if (!nxt) break;
      roadCenterTakeEdge(multi, cur, nxt);
      prefix.push(pt(nxt));
      prev = cur;
      cur = nxt;
    }
    polylines.push(dedupeConsecutive([...prefix.reverse(), ...pts]));
  }
  return polylines;
}

function roadCenterPolylinesToSvgPathD(polylines) {
  const parts = [];
  for (const pts of polylines) {
    if (!pts || pts.length < 2) continue;
    parts.push(
      `M ${pts[0].x} ${pts[0].y}${pts
        .slice(1)
        .map((p) => ` L ${p.x} ${p.y}`)
        .join('')}`,
    );
  }
  return parts.join(' ');
}

/**
 * @param {(gx: number, gy: number) => string} adminJunAt
 * @returns {string} SVG path `d`，可能为空串
 */
export function buildStrategicRoadAdminJurisdictionBoundaryPathD(
  roadCells,
  connectivity,
  mapColumns,
  mapRows,
  adminJunAt,
) {
  const segments = buildStrategicRoadAdminJurisdictionBoundarySegments(
    roadCells,
    connectivity,
    mapColumns,
    mapRows,
    adminJunAt,
  );
  if (!segments.length) return '';
  const polylines = mergeRoadCenterSegmentsToPolylines(segments);
  return roadCenterPolylinesToSvgPathD(polylines);
}
