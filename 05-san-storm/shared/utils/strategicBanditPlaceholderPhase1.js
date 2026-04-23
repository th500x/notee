/**
 * 匪寨大地图阶段一（17-6 §1.2）：颍川合并图每郡 2 个占位，形状为 **2×1** 或 **1×2** 骨牌，
 * 两格共用 **`banditPoiId`**（`san_1_bandit_{1|2}_yingchuan`，与 04-1 §15 / `targetPoiId` 同族）。与 `strategicRoadOverlay` 禁区一致。
 *
 * 依赖 `cells[row][col]` 的 terrain / object / `banditPoiId`（读旧快照时仍可能带 `cityId`，由 `readStrategicCellAnchorId` 统一识别）；可选 `roadCells`：**不占道路格**，且优先 **四邻贴路**。
 */

import { normalizeRoadCellList } from './strategicRoadOverlay.js';
import { readStrategicCellAnchorId } from './strategicCellAnchorId.js';

/** 锚点格 `object`：水平两格宽 → `bandit_horiz`；垂直两格高 → `bandit_vert`；延伸格 `object` 置空。 */
export const STRATEGIC_BANDIT_DOMINO_OBJECT_H = 'bandit_horiz';
export const STRATEGIC_BANDIT_DOMINO_OBJECT_V = 'bandit_vert';

/** 与 13-1 / 17-6 文档示例一致（颍川郡阶段一固定 2 个匪寨地图对象 ID） */
export const YINGCHUAN_PHASE1_BANDIT_POI_IDS = [
  'san_1_bandit_1_yingchuan',
  'san_1_bandit_2_yingchuan',
];

class SeededRandom {
  constructor(seed) {
    let s = Number(seed) >>> 0;
    if (!Number.isFinite(s)) s = Math.floor(Math.random() * 0xffffffff);
    this._state = s % 2147483647;
    if (this._state <= 0) this._state += 2147483646;
  }

  next() {
    this._state = (this._state * 1664525 + 1013904223) & 0xffffffff;
    return (this._state >>> 0) / 0x100000000;
  }

  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  bool() {
    return this.next() < 0.5;
  }
}

function terrainBlocksBandit(cell) {
  if (!cell) return true;
  const t = cell.terrain;
  return t === 'river' || t === 'lake';
}

/** @param {Set<string>} roadKeys `"gx,gy"` */
function buildRoadKeySet(roadCells, mapColumns, mapRows) {
  const set = new Set();
  const list = normalizeRoadCellList(roadCells);
  const W = Number(mapColumns) || 0;
  const H = Number(mapRows) || 0;
  for (const { gx, gy } of list) {
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;
    const x = Math.trunc(gx);
    const y = Math.trunc(gy);
    if (x < 0 || y < 0 || (W > 0 && x >= W) || (H > 0 && y >= H)) continue;
    set.add(`${x},${y}`);
  }
  return set;
}

/** 骨牌任一格落在道路栅格上 */
function dominoOverlapsRoad(roadSet, gx, gy, orientation) {
  if (!roadSet || roadSet.size === 0) return false;
  const keys =
    orientation === 'h' ? [`${gx},${gy}`, `${gx + 1},${gy}`] : [`${gx},${gy}`, `${gx},${gy + 1}`];
  return keys.some((k) => roadSet.has(k));
}

/**
 * 骨牌两格均非道路，且至少有一格的四邻（不含骨牌自身另一格）落在道路上。
 * @param {Set<string>} roadKeys
 */
function dominoTouchesRoad4(roadSet, gx, gy, orientation) {
  if (!roadSet || roadSet.size === 0) return false;
  const cells =
    orientation === 'h'
      ? [
          [gx, gy],
          [gx + 1, gy],
        ]
      : [
          [gx, gy],
          [gx, gy + 1],
        ];
  const domino = new Set(cells.map(([x, y]) => `${x},${y}`));
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [cx, cy] of cells) {
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      const nk = `${nx},${ny}`;
      if (domino.has(nk)) continue;
      if (roadSet.has(nk)) return true;
    }
  }
  return false;
}

function cellVacantForBandit(cells, gx, gy, occupied) {
  const H = cells.length;
  const W = cells[0]?.length ?? 0;
  if (gx < 0 || gy < 0 || gx >= W || gy >= H) return false;
  const key = `${gx},${gy}`;
  if (occupied.has(key)) return false;
  const cell = cells[gy][gx];
  if (!cell) return false;
  if (terrainBlocksBandit(cell)) return false;
  if (cell.object) return false;
  if (readStrategicCellAnchorId(cell)) return false;
  return true;
}

/**
 * @param {object[][]} cells
 * @param {number} gx anchor
 * @param {number} gy anchor
 * @param {'h'|'v'} orientation h = 2×1 (right), v = 1×2 (down)
 * @param {Set<string>} occupied
 */
function dominoVacant(cells, gx, gy, orientation, occupied) {
  if (orientation === 'h') {
    return (
      cellVacantForBandit(cells, gx, gy, occupied) &&
      cellVacantForBandit(cells, gx + 1, gy, occupied)
    );
  }
  return (
    cellVacantForBandit(cells, gx, gy, occupied) &&
    cellVacantForBandit(cells, gx, gy + 1, occupied)
  );
}

function paintDomino(cells, gx, gy, orientation, banditPoiId, displayName, occupied) {
  const anchorObj =
    orientation === 'h' ? STRATEGIC_BANDIT_DOMINO_OBJECT_H : STRATEGIC_BANDIT_DOMINO_OBJECT_V;
  const c0 = cells[gy][gx];
  c0.banditPoiId = banditPoiId;
  delete c0.cityId;
  delete c0.city_id;
  c0.cityName = displayName;
  c0.object = anchorObj;
  c0.col = gx;
  c0.row = gy;
  occupied.add(`${gx},${gy}`);

  if (orientation === 'h') {
    const c1 = cells[gy][gx + 1];
    c1.banditPoiId = banditPoiId;
    delete c1.cityId;
    delete c1.city_id;
    c1.cityName = displayName;
    c1.object = null;
    c1.col = gx + 1;
    c1.row = gy;
    occupied.add(`${gx + 1},${gy}`);
  } else {
    const c1 = cells[gy + 1][gx];
    c1.banditPoiId = banditPoiId;
    delete c1.cityId;
    delete c1.city_id;
    c1.cityName = displayName;
    c1.object = null;
    c1.col = gx;
    c1.row = gy + 1;
    occupied.add(`${gx},${gy + 1}`);
  }
}

export function stripYingchuanPhase1BanditCells(cells) {
  if (!cells?.length) return;
  const idSet = new Set(YINGCHUAN_PHASE1_BANDIT_POI_IDS);
  for (let gy = 0; gy < cells.length; gy++) {
    const row = cells[gy];
    if (!row) continue;
    for (let gx = 0; gx < row.length; gx++) {
      const cell = row[gx];
      if (!cell) continue;
      const cid = String(readStrategicCellAnchorId(cell)).trim();
      if (!idSet.has(cid)) continue;
      delete cell.banditPoiId;
      delete cell.bandit_poi_id;
      delete cell.cityId;
      delete cell.city_id;
      delete cell.cityName;
      delete cell.city_name;
      cell.object = null;
    }
  }
}

/**
 * @param {object[][]} cells
 * @param {number} seed
 * @param {{ roadCells?: unknown, mapColumns?: number, mapRows?: number }|null|undefined} [placement]
 */
export function applyYingchuanPhase1BanditPlaceholders(cells, seed = 0, placement = null) {
  if (!cells?.length || !cells[0]?.length) return;
  const H = cells.length;
  const W = cells[0].length;
  const rng = new SeededRandom((Number(seed) ^ 0xbadcafe) >>> 0);

  const roadCells = placement?.roadCells;
  const mapColumns = Number(placement?.mapColumns) || W;
  const mapRows = Number(placement?.mapRows) || H;
  const roadSet =
    Array.isArray(roadCells) && roadCells.length > 0
      ? buildRoadKeySet(roadCells, mapColumns, mapRows)
      : null;

  const occupied = new Set();
  for (let gy = 0; gy < H; gy++) {
    for (let gx = 0; gx < W; gx++) {
      const cell = cells[gy][gx];
      if (readStrategicCellAnchorId(cell)) occupied.add(`${gx},${gy}`);
    }
  }

  const margin = 2;
  const gxMin = margin;
  const gxMax = W - 2 - margin;
  const gyMin = margin;
  const gyMax = H - 2 - margin;
  if (gxMax < gxMin || gyMax < gyMin) return;

  for (let i = 0; i < YINGCHUAN_PHASE1_BANDIT_POI_IDS.length; i++) {
    const banditPoiId = YINGCHUAN_PHASE1_BANDIT_POI_IDS[i];
    let already = false;
    for (let gy = 0; gy < H && !already; gy++) {
      for (let gx = 0; gx < W; gx++) {
        const cid = String(readStrategicCellAnchorId(cells[gy][gx]) ?? '');
        if (cid === banditPoiId) {
          already = true;
          break;
        }
      }
    }
    if (already) continue;

    const displayName = i === 0 ? '颍川匪寨（一）' : '颍川匪寨（二）';
    let ok = false;

    const tryPaint = (requireRoadTouch) => {
      const maxAttempts = requireRoadTouch ? 900 : 500;
      for (let attempt = 0; attempt < maxAttempts && !ok; attempt++) {
        const gx = rng.int(gxMin, gxMax);
        const gy = rng.int(gyMin, gyMax);
        const orient = rng.bool() ? 'h' : 'v';
        if (!dominoVacant(cells, gx, gy, orient, occupied)) continue;
        if (roadSet && roadSet.size > 0) {
          if (dominoOverlapsRoad(roadSet, gx, gy, orient)) continue;
          if (requireRoadTouch && !dominoTouchesRoad4(roadSet, gx, gy, orient)) continue;
        }
        paintDomino(cells, gx, gy, orient, banditPoiId, displayName, occupied);
        ok = true;
      }
    };

    if (roadSet && roadSet.size > 0) {
      tryPaint(true);
      if (!ok) tryPaint(false);
    } else {
      tryPaint(false);
    }
  }
}

/**
 * 浅拷贝格网后幂等写入颍川阶段一匪寨占位。
 * 若提供非空 `roadCells`：先去掉本阶段匪寨再按「不占道 + 贴路优先」重放，与磁盘旧快照/生成器无道路信息时对齐。
 *
 * @param {object[][]} cells
 * @param {number} [seed] 与合并图 `seed` 一致（缺省 0）
 * @param {{ roadCells?: unknown, mapColumns?: number, mapRows?: number }|null} [options]
 * @returns {object[][]} 新二维数组（不修改入参）
 */
export function ensureYingchuanMergedMapCells(cells, seed = 0, options = null) {
  if (!cells?.length || !cells[0]?.length) return cells || [];
  const cloned = cells.map((row) =>
    (row || []).map((cell) => (cell && typeof cell === 'object' ? { ...cell } : cell)),
  );
  const roadCells = options?.roadCells;
  const mapColumns = options?.mapColumns;
  const mapRows = options?.mapRows;
  const hasRoads = Array.isArray(roadCells) && roadCells.length > 0;

  if (hasRoads) {
    stripYingchuanPhase1BanditCells(cloned);
    applyYingchuanPhase1BanditPlaceholders(cloned, seed, { roadCells, mapColumns, mapRows });
  } else {
    applyYingchuanPhase1BanditPlaceholders(cloned, seed, null);
  }
  return cloned;
}
