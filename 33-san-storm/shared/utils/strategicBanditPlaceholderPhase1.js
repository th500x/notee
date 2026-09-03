/**
 * 匪寨大地图阶段一（17-7）：S1 **汝南** 仍可每郡 **2** 枚骨牌占位。
 * **颍川** 已迁郡战场入口（13-8）：`ensure*` 仅 strip 旧骨牌，**不再**随机写入。
 *
 * 依赖 `cells[row][col]` 的 terrain / object / `banditPoiId`；可选 `roadCells`：**不占道路格**，且优先 **四邻贴路**。
 */

import { normalizeRoadCellList, buildStrategicObjectFootprintBlockedSet } from './strategicRoadOverlay.js';
import { readStrategicCellAnchorId } from './strategicCellAnchorId.js';

/** 锚点格 `object`：水平两格宽 → `bandit_horiz`；垂直两格高 → `bandit_vert`；延伸格 `object` 置空。 */
export const STRATEGIC_BANDIT_DOMINO_OBJECT_H = 'bandit_horiz';
export const STRATEGIC_BANDIT_DOMINO_OBJECT_V = 'bandit_vert';

/** 颍川战场绑定的唯一匪寨 POI（13-8） */
export const YINGCHUAN_BATTLEFIELD_BANDIT_POI_ID = 'san_1_bandit_1_yingchuan';

/** @deprecated 颍川不再随机两寨；保留常量供 strip / 进度迁移识别旧 `_2_` */
export const YINGCHUAN_PHASE1_BANDIT_POI_IDS = [
  'san_1_bandit_1_yingchuan',
  'san_1_bandit_2_yingchuan',
];

/** 汝南郡阶段一：须与 `jun_id === san_1_jun_runan` 及合并图 `junId` 一致 */
export const RUNAN_PHASE1_BANDIT_POI_IDS = ['san_1_bandit_1_runan', 'san_1_bandit_2_runan'];

/** strip 时用：清除误写入邻郡 slug 的旧占位 */
export const ALL_SAN1_YU_PHASE1_BANDIT_POI_IDS = [...YINGCHUAN_PHASE1_BANDIT_POI_IDS, ...RUNAN_PHASE1_BANDIT_POI_IDS];

/**
 * 需在合并图上 **随机骨牌落位** 的郡 POI 列表（颍川返回空 = 不落位）。
 * @param {string|null|undefined} junId
 * @returns {readonly string[]}
 */
export function getPhase1BanditPoiIdsForJun(junId) {
  const j = String(junId || '').trim();
  // TEMP 2026-07：汝南暂不启用 —— 不随机骨牌（恢复时解开下行）
  // if (j === 'san_1_jun_runan') return RUNAN_PHASE1_BANDIT_POI_IDS;
  if (j === 'san_1_jun_runan') return [];
  // 颍川：战场一寨，不随机骨牌
  if (j === 'san_1_jun_yingchuan') return [];
  return [];
}

/**
 * 库表 / 配额 ensure 用：颍川仅 `_1_`；汝南仍两 ID。
 * @param {string|null|undefined} junId
 * @returns {readonly string[]}
 */
export function getActiveBanditPoiIdsForJun(junId) {
  const j = String(junId || '').trim();
  // TEMP 2026-07：汝南暂不启用 —— ensure/配额不挂两寨（恢复时解开下行）
  // if (j === 'san_1_jun_runan') return RUNAN_PHASE1_BANDIT_POI_IDS;
  if (j === 'san_1_jun_runan') return [];
  if (j === 'san_1_jun_yingchuan') return [YINGCHUAN_BATTLEFIELD_BANDIT_POI_ID];
  return [];
}

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

/**
 * 去掉 S1 豫州两郡阶段一匪寨**骨牌**占位（含历史上误写入汝南底板上的 `*_yingchuan` id）。
 * **不得**清掉郡战场（13-8）入口/信息区上绑定的同一 `banditPoiId`，否则加载后点击无反应。
 */
export function stripPhase1BanditCells(cells) {
  if (!cells?.length) return;
  const idSet = new Set(ALL_SAN1_YU_PHASE1_BANDIT_POI_IDS);
  for (let gy = 0; gy < cells.length; gy++) {
    const row = cells[gy];
    if (!row) continue;
    for (let gx = 0; gx < row.length; gx++) {
      const cell = row[gx];
      if (!cell) continue;
      const cid = String(readStrategicCellAnchorId(cell)).trim();
      if (!idSet.has(cid)) continue;
      const zone = cell.battlefieldZone ?? cell.battlefield_zone;
      const bfId = cell.battlefieldId ?? cell.battlefield_id;
      if (
        cell.object === 'jun_battlefield' ||
        (zone != null && String(zone).trim() !== '') ||
        (bfId != null && String(bfId).trim() !== '')
      ) {
        continue;
      }
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

/** @deprecated 语义已扩展为「两郡阶段一」；请优先使用 {@link stripPhase1BanditCells} */
export const stripYingchuanPhase1BanditCells = stripPhase1BanditCells;

/**
 * @param {object[][]} cells
 * @param {number} seed
 * @param {string} junId - `san_1_jun_yingchuan` / `san_1_jun_runan`
 * @param {{ roadCells?: unknown, mapColumns?: number, mapRows?: number }|null|undefined} [placement]
 */
export function applyJunPhase1BanditPlaceholders(cells, seed = 0, junId, placement = null) {
  if (!cells?.length || !cells[0]?.length) return;
  const poiIds = getPhase1BanditPoiIdsForJun(junId);
  if (!poiIds.length) return;

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

  const occupied = buildStrategicObjectFootprintBlockedSet(cells, W, H);

  const margin = 2;
  const gxMin = margin;
  const gxMax = W - 2 - margin;
  const gyMin = margin;
  const gyMax = H - 2 - margin;
  if (gxMax < gxMin || gyMax < gyMin) return;

  const isRunan = String(junId || '').trim() === 'san_1_jun_runan';
  const displayNames = isRunan ? ['汝南匪寨（一）', '汝南匪寨（二）'] : ['颍川匪寨（一）', '颍川匪寨（二）'];

  for (let i = 0; i < poiIds.length; i++) {
    const banditPoiId = poiIds[i];
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

    const displayName = displayNames[i] || `匪寨（${i + 1}）`;
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
 * @param {object[][]} cells
 * @param {number} seed
 * @param {{ roadCells?: unknown, mapColumns?: number, mapRows?: number }|null|undefined} [placement]
 */
export function applyYingchuanPhase1BanditPlaceholders(cells, seed = 0, placement = null) {
  applyJunPhase1BanditPlaceholders(cells, seed, 'san_1_jun_yingchuan', placement);
}

/**
 * 浅拷贝格网后：先 strip 两郡阶段一匪寨骨牌占位；仅 **汝南** 再随机写入两枚。
 * **颍川**：只 strip，不落位（入口在战场，见 13-8）。
 *
 * @param {object[][]} cells
 * @param {number} [seed]
 * @param {string} junId
 * @param {{ roadCells?: unknown, mapColumns?: number, mapRows?: number }|null} [options]
 * @returns {object[][]}
 */
export function ensureJunMergedMapCells(cells, seed = 0, junId, options = null) {
  if (!cells?.length || !cells[0]?.length) return cells || [];
  const cloned = cells.map((row) =>
    (row || []).map((cell) => (cell && typeof cell === 'object' ? { ...cell } : cell)),
  );
  const jid = String(junId || '').trim();
  const isYingchuan = jid === 'san_1_jun_yingchuan';
  const isRunan = jid === 'san_1_jun_runan';
  if (!isYingchuan && !isRunan) {
    return cloned;
  }

  stripPhase1BanditCells(cloned);

  const poiIds = getPhase1BanditPoiIdsForJun(jid);
  if (!poiIds.length) {
    return cloned;
  }

  const roadCells = options?.roadCells;
  const mapColumns = options?.mapColumns;
  const mapRows = options?.mapRows;
  const hasRoads = Array.isArray(roadCells) && roadCells.length > 0;

  if (hasRoads) {
    applyJunPhase1BanditPlaceholders(cloned, seed, jid, { roadCells, mapColumns, mapRows });
  } else {
    applyJunPhase1BanditPlaceholders(cloned, seed, jid, null);
  }
  return cloned;
}

/**
 * 浅拷贝格网后：**仅 strip** 颍川旧骨牌（不再随机落位）。
 *
 * @param {object[][]} cells
 * @param {number} [seed]
 * @param {{ roadCells?: unknown, mapColumns?: number, mapRows?: number }|null} [options]
 * @returns {object[][]}
 */
export function ensureYingchuanMergedMapCells(cells, seed = 0, options = null) {
  return ensureJunMergedMapCells(cells, seed, 'san_1_jun_yingchuan', options);
}
