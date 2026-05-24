/**
 * 战略格网坐标 — 道路 / 行军 / 立足点 / POI 的**唯一口径**。
 *
 * ## 两种坐标（禁止在未标注体系下混用裸 `x`/`y`）
 *
 * | 名称 | 字段 | 用途 |
 * |------|------|------|
 * | **PlayerRoadCell**（玩家道路立足 · 持久化） | `junId` + `gx` + `gy`（`gy` 为**郡内**行 0…39） | `players.road_jun_id`、`road_position_x/y`；`GET road/self`；郡内 presence |
 * | **WorldMapCell**（叠放画布 · 演算） | `gx` + `worldGy`（世界行；颍川 0…39、汝南 40…79） | merged `cells`/`roadCells`、BFS、可通行键、`POST road/move` 响应 `path`、前端跳跳棋（`mapRows > 40`） |
 *
 * **单郡 40 行**且未叠放时：WorldMapCell 与 PlayerRoadCell 数值相同，但仍须带 `junId` 写库。
 *
 * ## 规则摘要
 * - 读库 → 演算：{@link playerRoadToWorldMapCell}
 * - 演算 → 写库：{@link worldMapCellToPlayerRoad}（POI 入城须用目标 POI 的 `junId` + 本地锚格，勿用路径末格条带覆盖 `junId`）
 * - 前端：`road/move` 在叠放图上返回的 `path[].y` 已是 **worldGy**（勿再对叠放图加郡偏移）
 *
 * @module strategicGridCoordinates
 */

import {
  STRATEGIC_COUNTY_MAP_ROWS,
  SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER,
  stackWorldRowOffsetForJunId,
  stackWorldGyFromLocalJunRow,
  stackLocalJunRowFromWorldGy,
  san1YuStrategicAdminJunIdAtWorldCell,
} from './strategicWorldMapStack.js';

export {
  STRATEGIC_COUNTY_MAP_ROWS,
  SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER,
  stackWorldRowOffsetForJunId,
  stackWorldGyFromLocalJunRow,
  stackLocalJunRowFromWorldGy,
  san1YuStrategicAdminJunIdAtWorldCell,
};

/**
 * @typedef {{ junId: string, gx: number, gy: number }} PlayerRoadCell
 * @typedef {{ gx: number, worldGy: number }} WorldMapCell
 */

/**
 * @param {number} mapRows - 合并格网总行数（叠放颍川+汝南为 80）
 * @returns {boolean}
 */
export function isStackedWorldMap(mapRows) {
  return Number(mapRows) > STRATEGIC_COUNTY_MAP_ROWS;
}

/**
 * @param {string|number|null|undefined} v
 * @returns {number|null}
 */
export function truncGridCoord(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * @param {string} junId
 * @param {number} gx
 * @param {number} localGy
 * @returns {PlayerRoadCell|null}
 */
export function playerRoadCell(junId, gx, localGy) {
  const j = String(junId || '').trim();
  const x = truncGridCoord(gx);
  const y = truncGridCoord(localGy);
  if (!j || x == null || y == null) return null;
  return { junId: j, gx: x, gy: y };
}

/**
 * @param {number} gx
 * @param {number} worldGy
 * @returns {WorldMapCell|null}
 */
export function worldMapCell(gx, worldGy) {
  const x = truncGridCoord(gx);
  const wy = truncGridCoord(worldGy);
  if (x == null || wy == null) return null;
  return { gx: x, worldGy: wy };
}

/**
 * 持久化立足点 → 叠放画布格（BFS / 占格校验 / 距离）。
 * @param {PlayerRoadCell|string} junOrCell
 * @param {number} [gx]
 * @param {number} [localGy]
 * @returns {WorldMapCell|null}
 */
export function playerRoadToWorldMapCell(junOrCell, gx, localGy) {
  if (junOrCell && typeof junOrCell === 'object' && junOrCell.junId != null) {
    const c = playerRoadCell(junOrCell.junId, junOrCell.gx, junOrCell.gy);
    if (!c) return null;
    return worldMapCell(c.gx, stackWorldGyFromLocalJunRow(c.junId, c.gy));
  }
  const c = playerRoadCell(junOrCell, gx, localGy);
  if (!c) return null;
  return worldMapCell(c.gx, stackWorldGyFromLocalJunRow(c.junId, c.gy));
}

/**
 * 叠放画布格 → 写库用的 PlayerRoadCell。
 * @param {number} gx
 * @param {number} worldGy
 * @returns {PlayerRoadCell|null}
 */
export function worldMapCellToPlayerRoad(gx, worldGy) {
  const w = worldMapCell(gx, worldGy);
  if (!w) return null;
  const loc = stackLocalJunRowFromWorldGy(w.worldGy);
  if (!loc?.junId) return null;
  return { junId: loc.junId, gx: w.gx, gy: loc.localGy };
}

/**
 * @param {number} gx
 * @param {number} worldGy
 * @returns {string}
 */
export function worldMapCellKey(gx, worldGy) {
  const w = worldMapCell(gx, worldGy);
  if (!w) return '';
  return `${w.gx},${w.worldGy}`;
}

/**
 * @param {string} key
 * @returns {WorldMapCell|null}
 */
export function parseWorldMapCellKey(key) {
  const s = String(key ?? '').trim().replace(/\s/g, '');
  const parts = s.split(',');
  if (parts.length < 2) return null;
  return worldMapCell(parts[0], parts[1]);
}

/**
 * POI 入城写库：`road_position_*` 与 `road_jun_id` 必须同源（均为 PlayerRoadCell）。
 * @param {{ x: number, y: number }|null|undefined} poiAnchorLocal
 * @param {string|null|undefined} poiAnchorJunId
 * @returns {{ junId: string, gx: number, gy: number }|null}
 */
export function playerRoadDestFromPoiAnchor(poiAnchorLocal, poiAnchorJunId) {
  const j = poiAnchorJunId != null ? String(poiAnchorJunId).trim() : '';
  const x = truncGridCoord(poiAnchorLocal?.x);
  const y = truncGridCoord(poiAnchorLocal?.y);
  if (!j || x == null || y == null) return null;
  return { junId: j, gx: x, gy: y };
}

/**
 * 道路段终点（仍在路上）写库：由世界行末格拆条带。
 * @param {number} worldGx
 * @param {number} worldGy
 * @returns {PlayerRoadCell|null}
 */
export function playerRoadDestFromWorldPathEnd(worldGx, worldGy) {
  return worldMapCellToPlayerRoad(worldGx, worldGy);
}

/**
 * 曼哈顿距离（叠放图用世界行；单郡时与本地行相同）。
 * @param {WorldMapCell|null|undefined} a
 * @param {WorldMapCell|null|undefined} b
 * @returns {number}
 */
export function worldMapManhattanDistance(a, b) {
  if (!a || !b) return Infinity;
  return Math.abs(a.gx - b.gx) + Math.abs(a.worldGy - b.worldGy);
}

/**
 * 己方城锚格（PlayerRoadCell）与立足点（PlayerRoadCell）的距离。
 * @param {PlayerRoadCell} standLocal
 * @param {PlayerRoadCell} fromLocal
 * @returns {number}
 */
export function playerRoadAnchorDistance(standLocal, fromLocal) {
  const a = playerRoadToWorldMapCell(fromLocal);
  const b = playerRoadToWorldMapCell(standLocal);
  return worldMapManhattanDistance(a, b);
}

/**
 * `road/move` 响应 path → 前端跳跳棋用世界行路径（叠放图勿再加郡偏移）。
 * @param {Array<{x?: number, y?: number}>} path
 * @param {number} mapRows
 * @returns {Array<{x: number, y: number}>}
 */
export function roadMovePathForMarchAnimation(path, mapRows) {
  if (!Array.isArray(path) || !path.length) return [];
  const stacked = isStackedWorldMap(mapRows);
  return path.map((p) => {
    const x = truncGridCoord(p?.x);
    const y = truncGridCoord(p?.y);
    if (x == null || y == null) return { x: 0, y: 0 };
    if (stacked) return { x, y };
    return { x, y };
  });
}

/**
 * POI 入城后跳跳棋末帧：道路段终点常为「城旁道路格」，须再补一格城锚点（世界行）。
 * @param {Array<{x: number, y: number}>} animPath
 * @param {{ x?: number, y?: number }|null|undefined} poiAnchorLocal
 * @param {string|null|undefined} roadJunId
 * @returns {Array<{x: number, y: number}>}
 */
export function appendPoiSnapToMarchAnimPath(animPath, poiAnchorLocal, roadJunId) {
  if (!Array.isArray(animPath) || !animPath.length || !poiAnchorLocal) return animPath || [];
  const w = playerRoadToWorldMapCell(roadJunId, poiAnchorLocal.x, poiAnchorLocal.y);
  if (!w) return animPath;
  const last = animPath[animPath.length - 1];
  if (last && last.x === w.gx && last.y === w.worldGy) return animPath;
  return [...animPath, { x: w.gx, y: w.worldGy }];
}

/**
 * 客户端预览 path（可能混用）→ 提交前统一为世界行（与后端 BFS 一致）。
 * @param {Array<{x?: number, y?: number}>} path
 * @param {number} mapRows
 * @param {string} playerJunId
 * @returns {Array<{x: number, y: number}>}
 */
export function normalizeClientMarchPathToWorld(path, mapRows, playerJunId) {
  if (!Array.isArray(path) || !path.length) return [];
  if (isStackedWorldMap(mapRows)) {
    return roadMovePathForMarchAnimation(path, mapRows);
  }
  const off = stackWorldRowOffsetForJunId(playerJunId);
  return path.map((p) => {
    const x = truncGridCoord(p?.x) ?? 0;
    const y = (truncGridCoord(p?.y) ?? 0) + off;
    return { x, y };
  });
}

/**
 * 郡内 `gy` → 叠放画布世界行（勿直接调 `stackWorldGyFromLocalJunRow`）。
 * @param {string} junId
 * @param {number} localGy
 * @returns {number|null}
 */
export function worldGyFromPlayerRoadLocal(junId, localGy) {
  const w = playerRoadToWorldMapCell(junId, 0, localGy);
  return w != null ? w.worldGy : null;
}

/**
 * 世界行 → `{ junId, localGy }`（勿直接调 `stackLocalJunRowFromWorldGy`）。
 * @param {number} worldGy
 * @returns {{ junId: string, localGy: number }|null}
 */
export function playerRoadJunSliceFromWorldGy(worldGy) {
  return stackLocalJunRowFromWorldGy(worldGy);
}

/** 同 {@link worldMapCellToPlayerRoad}，命名强调「世界格 → 写库 PlayerRoadCell」。 */
export function playerRoadFromWorldMapCell(gx, worldGy) {
  return worldMapCellToPlayerRoad(gx, worldGy);
}

/**
 * `cities.position_x/y`（郡内锚格）→ WorldMapCell（缩略图 / 邻近高亮与库一致）。
 * @param {object|null|undefined} cityRow
 * @returns {WorldMapCell|null}
 */
export function worldMapCellFromCityDbRow(cityRow) {
  const jid = String(cityRow?.jun_id ?? cityRow?.junId ?? '').trim();
  const lx = truncGridCoord(cityRow?.position_x ?? cityRow?.positionX);
  const ly = truncGridCoord(cityRow?.position_y ?? cityRow?.positionY);
  if (!jid || lx == null || ly == null) return null;
  return playerRoadToWorldMapCell(jid, lx, ly);
}

/**
 * PlayerRoadCell → 叠放世界格键 `"gx,worldGy"`。
 * @param {string} junId
 * @param {number} gx
 * @param {number} localGy
 * @returns {string}
 */
export function worldMapCellKeyFromPlayerRoadLocal(junId, gx, localGy) {
  const w = playerRoadToWorldMapCell(junId, gx, localGy);
  if (!w) return '';
  return worldMapCellKey(w.gx, w.worldGy);
}
