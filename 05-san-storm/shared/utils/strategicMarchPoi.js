/**
 * 战略行军：城心 / 匪寨 POI 终点（31-6 §9.4）。
 * 与 `game/src/utils/strategicRoadMarchPath.js`、`roadEncounterService.moveAlongRoad` 共用寻路语义。
 */

import {
  normalizeRoadCellList,
  buildStrategicObjectFootprintBlockedSet,
} from './strategicRoadOverlay.js';
import { isHostileByFaction } from './roadDiplomacy.js';

const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** POI 邻接道路终点候选用：含对角，避免「贴城角」道路格被漏掉导致绕远路 */
const DIRS8 = [
  ...DIRS4,
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** 匪寨 `city_id` 识别（与 13-1 口径一致，写死扩展） */
export function isBanditCityId(cityId) {
  return /(^|_)bandit(_|$)/i.test(String(cityId || ''));
}

/** 可作为 POI 终点的城池类 `object`（2×2 左上锚点；不含关隘/据点） */
export function isCityPoiStrategicObject(objectType) {
  const o = String(objectType || '');
  return o === 'city_small' || o === 'city_medium' || o === 'city_major';
}

/** 与 DB `cities.city_type` 对齐的可行军城池类（不含 fort / gate / 荒郊集市等） */
export function isAllowedPlayerCityPoiCityType(cityType) {
  const t = String(cityType || '');
  return t === 'city_major' || t === 'city_medium' || t === 'city_small';
}

/**
 * @param {object|null|undefined} cityRow - `cityById[cityId]`（camelCase 或 snake_case）
 * @param {string} cityId
 * @param {string|number|null|undefined} playerFactionId
 */
export function canPlayerMarchToPoiCity({ cityRow, cityId, playerFactionId }) {
  const id = String(cityId || '').trim();
  if (!id) return { ok: false, error: '缺少城池标识' };
  if (isBanditCityId(id)) return { ok: true };
  const row = cityRow || {};
  const ct = row.city_type ?? row.cityType;
  if (!isAllowedPlayerCityPoiCityType(ct)) {
    return { ok: false, error: '该地物不可作为行军终点' };
  }
  const fid = row.faction_id ?? row.factionId;
  if (fid == null || String(fid) !== String(playerFactionId ?? '')) {
    return { ok: false, error: '仅可移动至本势力城池或匪寨' };
  }
  return { ok: true };
}

/**
 * @param {object[][]} cells
 * @param {string} cityId
 * @param {number} mapColumns
 * @param {number} mapRows
 * @returns {{ keys: Set<string>, anchorGx: number, anchorGy: number, width: number, height: number, kind: 'city_2x2'|'bandit_domino' } | null}
 */
export function collectStrategicPoiFootprint(cells, cityId, mapColumns, mapRows) {
  const id = String(cityId || '').trim();
  if (!id || !cells?.length) return null;

  for (let gy = 0; gy < mapRows; gy++) {
    const row = cells[gy];
    if (!row) continue;
    for (let gx = 0; gx < mapColumns; gx++) {
      const cell = row[gx];
      if (!cell?.cityId || String(cell.cityId) !== id) continue;
      if (isCityPoiStrategicObject(cell.object)) {
        const keys = new Set();
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const x = gx + dx;
            const y = gy + dy;
            if (x < mapColumns && y < mapRows) keys.add(`${x},${y}`);
          }
        }
        return { keys, anchorGx: gx, anchorGy: gy, width: 2, height: 2, kind: 'city_2x2' };
      }
    }
  }

  if (isBanditCityId(id)) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let any = false;
    for (let gy = 0; gy < mapRows; gy++) {
      const row = cells[gy];
      if (!row) continue;
      for (let gx = 0; gx < mapColumns; gx++) {
        const cell = row[gx];
        if (!cell?.cityId || String(cell.cityId) !== id) continue;
        any = true;
        minX = Math.min(minX, gx);
        minY = Math.min(minY, gy);
        maxX = Math.max(maxX, gx);
        maxY = Math.max(maxY, gy);
      }
    }
    if (!any) return null;
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (w * h !== 2 || (w !== 2 && h !== 2)) return null;
    const keys = new Set();
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        keys.add(`${x},${y}`);
      }
    }
    return { keys, anchorGx: minX, anchorGy: minY, width: w, height: h, kind: 'bandit_domino' };
  }

  return null;
}

/**
 * 城市 / 匪寨 POI footprint：**优先** `cities.position_x / position_y`（管理端地图工具写入库），
 * 再扫合并格 `cells`（匪寨形状、或库内缺坐标时）。
 *
 * @param {object|null|undefined} cityRow - API / SQL 行（camelCase 或 snake_case）
 * @param {number} mapColumns
 * @param {number} mapRows
 * @param {object[][]|null|undefined} [cellsFallback]
 * @returns {{ keys: Set<string>, anchorGx: number, anchorGy: number, width: number, height: number, kind: string } | null}
 */
export function buildStrategicPoiFootprintFromDbCityRow(cityRow, mapColumns, mapRows, cellsFallback = null) {
  const id = cityRow?.city_id ?? cityRow?.cityId ?? cityRow?.id;
  const pxRaw = cityRow?.position_x ?? cityRow?.positionX;
  const pyRaw = cityRow?.position_y ?? cityRow?.positionY;
  const ct = cityRow?.city_type ?? cityRow?.cityType;
  const px = Number(pxRaw);
  const py = Number(pyRaw);

  if (!Number.isFinite(px) || !Number.isFinite(py)) {
    if (cellsFallback?.length && id) {
      return collectStrategicPoiFootprint(cellsFallback, String(id), mapColumns, mapRows);
    }
    return null;
  }
  const gx = Math.trunc(px);
  const gy = Math.trunc(py);
  if (gx < 0 || gy < 0 || gx >= mapColumns || gy >= mapRows) {
    if (cellsFallback?.length && id) {
      return collectStrategicPoiFootprint(cellsFallback, String(id), mapColumns, mapRows);
    }
    return null;
  }

  if (isBanditCityId(id)) {
    if (cellsFallback?.length) {
      return collectStrategicPoiFootprint(cellsFallback, String(id), mapColumns, mapRows);
    }
    return null;
  }

  if (isAllowedPlayerCityPoiCityType(ct)) {
    const keys = new Set();
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = gx + dx;
        const y = gy + dy;
        if (x < mapColumns && y < mapRows) keys.add(`${x},${y}`);
      }
    }
    return { keys, anchorGx: gx, anchorGy: gy, width: 2, height: 2, kind: 'city_2x2' };
  }

  if (cellsFallback?.length && id) {
    return collectStrategicPoiFootprint(cellsFallback, String(id), mapColumns, mapRows);
  }
  return null;
}

/**
 * `(gx,gy)` 落在郡内哪座城的库坐标 footprint 内（用于离路立点）。
 * @param {object[]} cityRows - `GET /cities` 等与库一致的行列表
 */
export function resolvePoiFootprintAtCellFromDb(cityRows, gx, gy, mapColumns, mapRows, cellsFallback = null) {
  const k0 = `${Math.trunc(gx)},${Math.trunc(gy)}`;
  if (!Array.isArray(cityRows) || !cityRows.length) return null;
  for (const row of cityRows) {
    const fp = buildStrategicPoiFootprintFromDbCityRow(row, mapColumns, mapRows, cellsFallback);
    if (fp?.keys?.has(k0)) return fp;
  }
  return null;
}

export function findPoiFootprintKeysContainingCellFromDb(cityRows, gx, gy, mapColumns, mapRows, cellsFallback = null) {
  const fp = resolvePoiFootprintAtCellFromDb(cityRows, gx, gy, mapColumns, mapRows, cellsFallback);
  return fp?.keys ?? null;
}

export function buildRoadPassableKeySetForMarch(roadCells, cells, mapColumns, mapRows) {
  const list = normalizeRoadCellList(roadCells);
  const blocked = buildStrategicObjectFootprintBlockedSet(cells, mapColumns, mapRows);
  const set = new Set();
  for (const { gx, gy } of list) {
    const k = `${gx},${gy}`;
    if (!blocked.has(k)) set.add(k);
  }
  return set;
}

/** 道路子图 BFS 最短路长（步数） */
function bfsRoadDistances(roadPassable, seedKeys, mapColumns, mapRows) {
  const dist = new Map();
  const queue = [];
  for (const sk of seedKeys) {
    if (!roadPassable.has(sk)) continue;
    if (!dist.has(sk)) {
      dist.set(sk, 0);
      queue.push(sk);
    }
  }
  while (queue.length) {
    const k = queue.shift();
    const d = dist.get(k);
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= mapColumns || ny >= mapRows) continue;
      const nk = `${nx},${ny}`;
      if (!roadPassable.has(nk) || dist.has(nk)) continue;
      dist.set(nk, d + 1);
      queue.push(nk);
    }
  }
  return dist;
}

function edgeDistanceToMapBounds(x, y, mapColumns, mapRows) {
  return Math.min(x, y, mapColumns - 1 - x, mapRows - 1 - y);
}

/** 从 cur 沿最短路向起点方向退一步：在 distFrom 比 cur 浅 1 的邻格中选 distTo 更小、且更远离地图边界的格（打破「等长最短路贴边走」） */
function pickPredecessorTowardStart(roadPassable, curKey, distFrom, distTo, mapColumns, mapRows) {
  const [cx, cy] = curKey.split(',').map(Number);
  const depth = distFrom.get(curKey);
  if (depth == null || depth <= 0) return null;
  let bestNk = null;
  let bestDto = Infinity;
  let bestEdge = -Infinity;
  for (const [dx, dy] of DIRS4) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= mapColumns || ny >= mapRows) continue;
    const nk = `${nx},${ny}`;
    if (!roadPassable.has(nk)) continue;
    if (distFrom.get(nk) !== depth - 1) continue;
    const dto = distTo.get(nk);
    if (dto == null) continue;
    const ed = edgeDistanceToMapBounds(nx, ny, mapColumns, mapRows);
    if (
      bestNk == null ||
      dto < bestDto ||
      (dto === bestDto && ed > bestEdge) ||
      (dto === bestDto && ed === bestEdge && nk < bestNk)
    ) {
      bestNk = nk;
      bestDto = dto;
      bestEdge = ed;
    }
  }
  return bestNk;
}

function reconstructShortestPathGoalBiased(roadPassable, distFrom, endKey, mapColumns, mapRows) {
  if (!distFrom.has(endKey)) return null;
  const distTo = bfsRoadDistances(roadPassable, [endKey], mapColumns, mapRows);
  const keysRev = [endKey];
  let cur = endKey;
  while (distFrom.get(cur) > 0) {
    const pred = pickPredecessorTowardStart(roadPassable, cur, distFrom, distTo, mapColumns, mapRows);
    if (!pred) return null;
    keysRev.push(pred);
    cur = pred;
  }
  keysRev.reverse();
  return keysRev.map((key) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  });
}

function bfsShortestPath(roadPassable, startKey, endKey, mapColumns, mapRows) {
  if (!roadPassable.has(startKey) || !roadPassable.has(endKey)) return null;
  const distFrom = bfsRoadDistances(roadPassable, [startKey], mapColumns, mapRows);
  return reconstructShortestPathGoalBiased(roadPassable, distFrom, endKey, mapColumns, mapRows);
}

function multiSourceBfsShortest(roadPassable, startKeys, endKey, mapColumns, mapRows) {
  if (!roadPassable.has(endKey)) return null;
  const seeds = [...startKeys].filter((sk) => roadPassable.has(sk));
  if (!seeds.length) return null;
  const distFrom = bfsRoadDistances(roadPassable, seeds, mapColumns, mapRows);
  return reconstructShortestPathGoalBiased(roadPassable, distFrom, endKey, mapColumns, mapRows);
}

/** 与文件内 `bfsShortestPath` 同语义，供 game 侧 `@/utils/strategicRoadMarchPath` 复用 */
export function bfsShortestPathRoad(roadPassable, startKey, endKey, mapColumns, mapRows) {
  return bfsShortestPath(roadPassable, startKey, endKey, mapColumns, mapRows);
}

export function multiSourceBfsShortestRoad(roadPassable, startKeys, endKey, mapColumns, mapRows) {
  return multiSourceBfsShortest(roadPassable, startKeys, endKey, mapColumns, mapRows);
}

/**
 * 若 `(gx,gy)` 落在某战略 POI 占格（本势力城 2×2 或匪寨 1×2/2×1）内，返回该对象 footprint 的格键集合。
 * @returns {Set<string>|null}
 */
export function findPoiFootprintKeysContainingCell(cells, gx, gy, mapColumns, mapRows) {
  const k0 = `${Math.trunc(gx)},${Math.trunc(gy)}`;
  const seenIds = new Set();
  for (let ri = 0; ri < mapRows; ri++) {
    const row = cells[ri];
    if (!row) continue;
    for (let ci = 0; ci < mapColumns; ci++) {
      const cell = row[ci];
      const cid = cell?.cityId ? String(cell.cityId) : '';
      if (!cid || seenIds.has(cid)) continue;
      seenIds.add(cid);
      const fp = collectStrategicPoiFootprint(cells, cid, mapColumns, mapRows);
      if (fp?.keys?.has(k0)) return fp.keys;
    }
  }
  return null;
}

export function roadKeysAdjacentToFootprint(footprintKeys, roadPassable) {
  const out = new Set();
  for (const fk of footprintKeys) {
    const [gx, gy] = fk.split(',').map(Number);
    for (const [dx, dy] of DIRS4) {
      const nk = `${gx + dx},${gy + dy}`;
      if (roadPassable.has(nk)) out.add(nk);
    }
  }
  return out;
}

/**
 * 作为 **POI 沿路终点** 的道路格：与 footprint 四邻或对角邻（仍在 `roadPassable` 内）。
 * 仅用四邻时，与城块仅对角相接的合法道路格不会进入候选，寻路会绕到另一侧，末段再写入城内易表现为「瞬移」。
 * @param {Set<string>|Iterable<string>} footprintKeys
 * @param {Set<string>} roadPassable
 * @returns {Set<string>}
 */
export function roadKeysAdjacentOrDiagonalToFootprint(footprintKeys, roadPassable) {
  const out = new Set();
  for (const fk of footprintKeys) {
    const [gx, gy] = fk.split(',').map(Number);
    for (const [dx, dy] of DIRS8) {
      const nk = `${gx + dx},${gy + dy}`;
      if (roadPassable.has(nk)) out.add(nk);
    }
  }
  return out;
}

/**
 * 郡内他人路点中、相对 `moverFactionId` 为敌对势力的格键（`"gx,gy"`），用于沿路 BFS 绕行（不可途经叠格）。
 * @param {string|null|undefined} moverFactionId
 * @param {Iterable<object>|null|undefined} rows - `road-presence.others` 或 SQL 行（camelCase / snake_case 混排）
 * @returns {Set<string>}
 */
export function buildHostileOccupiedRoadKeysFromPlayersRows(moverFactionId, rows) {
  const out = new Set();
  if (rows == null) return out;
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const fid = r.factionId ?? r.faction_id;
    if (!isHostileByFaction(moverFactionId, fid)) continue;
    const x = Math.trunc(Number(r.roadPositionX ?? r.road_position_x));
    const y = Math.trunc(Number(r.roadPositionY ?? r.road_position_y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.add(`${x},${y}`);
  }
  return out;
}

/**
 * 离路时沿路出发/首跳校验用的 **城寨占格**：`road_position` 若在某一城/寨 POI 块内则 **优先** 用该块（已到城 A 但 `main_city_id` 仍为阳翟时，不得从主城块出发）。
 * @param {(cells: object[][], mainId: string) => Set<string>|null|undefined} collectMainCityFootprintKeys
 * @returns {Set<string>}
 */
export function resolveOffRoadMarchDepartureFootprintKeys(
  cells,
  player,
  countyJunId,
  mapColumns,
  mapRows,
  collectMainCityFootprintKeys,
  poiOptions = {},
) {
  const {
    mainCityDbRow = null,
    citiesInCountyRows = null,
  } = poiOptions || {};

  const roadJun = player?.road_jun_id || null;
  const rx = Number(player?.road_position_x);
  const ry = Number(player?.road_position_y);
  if (roadJun === countyJunId && Number.isFinite(rx) && Number.isFinite(ry)) {
    let poiFp = null;
    if (Array.isArray(citiesInCountyRows) && citiesInCountyRows.length) {
      poiFp = findPoiFootprintKeysContainingCellFromDb(citiesInCountyRows, rx, ry, mapColumns, mapRows, cells);
    }
    if (!poiFp?.size) {
      poiFp = findPoiFootprintKeysContainingCell(cells, Math.trunc(rx), Math.trunc(ry), mapColumns, mapRows);
    }
    if (poiFp?.size) return poiFp;
  }
  const mainId = player?.main_city_id;
  if (mainCityDbRow && mainId) {
    const fpDb = buildStrategicPoiFootprintFromDbCityRow(mainCityDbRow, mapColumns, mapRows, cells);
    if (fpDb?.keys?.size) return fpDb.keys;
  }
  if (typeof collectMainCityFootprintKeys === 'function' && mainId) {
    const fpMain = collectMainCityFootprintKeys(cells, mainId);
    if (fpMain?.size) return fpMain;
  }
  return new Set();
}

/**
 * 在 candidateKeys（均为道路格）中选与 start 沿路最短路最短的一格；平手取坐标字典序较小。
 * @param {Set<string>} roadPassable
 * @param {string} startKey - 必须在 roadPassable 内
 * @param {Iterable<string>} candidateKeys
 */
export function pickNearestRoadTargetAmongCandidates(roadPassable, startKey, candidateKeys, mapColumns, mapRows) {
  let bestKey = null;
  let bestLen = Infinity;
  const cands = [...candidateKeys].filter((k) => roadPassable.has(k)).sort();
  for (const endKey of cands) {
    const path = bfsShortestPath(roadPassable, startKey, endKey, mapColumns, mapRows);
    if (!path) continue;
    const len = path.length - 1;
    if (len < bestLen || (len === bestLen && endKey < String(bestKey || ''))) {
      bestLen = len;
      bestKey = endKey;
    }
  }
  if (!bestKey) return null;
  return bfsShortestPath(roadPassable, startKey, bestKey, mapColumns, mapRows);
}

/**
 * 多起点（主城邻接道路 或 POI 邻接道路）→ 候选道路终点中沿路总长短者优。
 * @param {Set<string>} startKeys
 */
export function pickNearestRoadTargetMultiStart(roadPassable, startKeys, candidateKeys, mapColumns, mapRows) {
  let bestKey = null;
  let bestLen = Infinity;
  const cands = [...candidateKeys].filter((k) => roadPassable.has(k)).sort();
  for (const endKey of cands) {
    const path = multiSourceBfsShortest(roadPassable, startKeys, endKey, mapColumns, mapRows);
    if (!path) continue;
    const len = path.length - 1;
    if (len < bestLen || (len === bestLen && endKey < String(bestKey || ''))) {
      bestLen = len;
      bestKey = endKey;
    }
  }
  if (!bestKey) return null;
  return multiSourceBfsShortest(roadPassable, startKeys, bestKey, mapColumns, mapRows);
}

/**
 * @param {object[][]} cells
 * @param {unknown} roadCells
 * @param {number} mapColumns
 * @param {number} mapRows
 * @param {string} countyJunId
 * @param {object} player - profile.player
 * @param {string} targetCityId
 * @param {(keys: Set<string>) => Set<string>} [collectMainCityFootprint] - 注入以便与后端 `roadGrid` 一致
 * @param {Set<string>|null|undefined} [hostileOccupiedRoadKeys] - 已废弃：最短路按**完整**道路网计算；敌对叠格在逐步 `moveAlongRoad` 时触发遭遇/拦截，不作为寻路障碍（与产品「始终最短路径」一致）。
 */
export function buildMarchPathToStrategicPoi({
  cells,
  roadCells,
  mapColumns,
  mapRows,
  countyJunId,
  player,
  targetCityId,
  collectMainCityFootprintKeys,
  targetCityDbRow = null,
  mainCityDbRow = null,
  citiesInCountyRows = null,
  hostileOccupiedRoadKeys = null,
}) {
  if (!cells?.length || !roadCells?.length) {
    return { ok: false, error: '当前地图缺少道路数据' };
  }
  const roadPassable = buildRoadPassableKeySetForMarch(roadCells, cells, mapColumns, mapRows);
  /* 保留入参以兼容旧调用；寻路不再剔除敌对占格。 */
  void hostileOccupiedRoadKeys;
  let poi = null;
  if (targetCityDbRow) {
    poi = buildStrategicPoiFootprintFromDbCityRow(targetCityDbRow, mapColumns, mapRows, cells);
  }
  if (!poi?.keys?.size) {
    poi = collectStrategicPoiFootprint(cells, targetCityId, mapColumns, mapRows);
  }
  if (!poi?.keys?.size) {
    return { ok: false, error: '目标城池不在当前郡格网内' };
  }
  const adjRoad = roadKeysAdjacentOrDiagonalToFootprint(poi.keys, roadPassable);
  if (!adjRoad.size) {
    return { ok: false, error: '目标旁无可用道路格，无法接近' };
  }

  const roadJun = player?.road_jun_id || null;
  const rx = Number(player?.road_position_x);
  const ry = Number(player?.road_position_y);
  const startKeyIfRoad =
    roadJun === countyJunId && Number.isFinite(rx) && Number.isFinite(ry) ? `${Math.trunc(rx)},${Math.trunc(ry)}` : null;
  const onRoadCell = startKeyIfRoad && roadPassable.has(startKeyIfRoad);

  let path = null;
  if (onRoadCell) {
    path = pickNearestRoadTargetAmongCandidates(roadPassable, startKeyIfRoad, adjRoad, mapColumns, mapRows);
  } else {
    const footprintKeys = resolveOffRoadMarchDepartureFootprintKeys(
      cells,
      player,
      countyJunId,
      mapColumns,
      mapRows,
      collectMainCityFootprintKeys,
      { mainCityDbRow, citiesInCountyRows },
    );
    if (!footprintKeys.size) {
      const mainId = player?.main_city_id;
      if (!mainId) return { ok: false, error: '未设置主城且未在道路上，无法出发' };
      return { ok: false, error: '主城不在当前郡地图内' };
    }
    const starts = roadKeysAdjacentToFootprint(footprintKeys, roadPassable);
    if (!starts.size) return { ok: false, error: '出发地旁没有可通行的道路格' };
    path = pickNearestRoadTargetMultiStart(roadPassable, starts, adjRoad, mapColumns, mapRows);
  }

  if (!path?.length) return { ok: false, error: '无法沿道路到达目标邻近道路格' };

  return {
    ok: true,
    path,
    onRoadAtStart: !!onRoadCell,
    poiAnchor: { x: poi.anchorGx, y: poi.anchorGy },
    targetCityId: String(targetCityId),
  };
}
