/**
 * 战略行军：城心 / 匪寨 POI 终点（31-6 §7）。
 * 与 `game/src/utils/strategicRoadMarchPath.js`、`roadEncounterService.moveAlongRoad` 共用寻路语义。
 *
 * 道路最短路：边界格（四邻存在非道路）默认可作 **仅起点/终点**；BFS 禁作途经，无内道宽时回退全道路网。
 * 等长路回溯：用 **走廊向内深度** 打破平局（勿用离地图矩形边的距离）。
 */

import {
  normalizeRoadCellList,
  buildStrategicObjectFootprintBlockedSet,
} from './strategicRoadOverlay.js';
import {
  playerRoadToWorldMapCell,
  worldMapCellKey,
  playerRoadJunSliceFromWorldGy,
  stackWorldRowOffsetForJunId,
  STRATEGIC_COUNTY_MAP_ROWS,
  SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER,
} from './strategicGridCoordinates.js';

export {
  playerRoadToWorldMapCell,
  worldMapCellToPlayerRoad,
  worldMapCellKey,
  isStackedWorldMap,
  playerRoadDestFromPoiAnchor,
} from './strategicGridCoordinates.js';
import { isHostileByFaction } from './roadDiplomacy.js';
import { readStrategicCellAnchorId } from './strategicCellAnchorId.js';
import { isBanditMapObjectId } from './smallMapEnemyRoster.js';

/** 与 `smallMapEnemyRoster.isBanditMapObjectId` 同义；供 CJS `require` 侧（如 `roadEncounterService`）判定匪寨终点，避免误查 `cities`。 */
export { isBanditMapObjectId };

/** `wars_pvp.pvp_war_id`（如 `san_1_war_0015`）。与 `cities.city_id`、匪寨 id 区分；缺 baseCamp 时不得回退城心寻路。 */
export function isPvpWarMarchTargetId(id) {
  const t = String(id || '').trim();
  if (!t || isBanditMapObjectId(t)) return false;
  return t.includes('_war_');
}

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
 * @param {object|null|undefined} cityRow - `cityById[…]`（camelCase 或 snake_case）；匪寨可无表行
 * @param {string} targetPoiId - 城池主键或 **匪寨地图对象 ID** `san_*_bandit_*`（与 HTTP `targetPoiId` / `banditPoiId` 同族）
 * @param {string|number|null|undefined} playerFactionId
 */
export function canPlayerMarchToPoiCity({ cityRow, targetPoiId, playerFactionId, pvpCampAttackerFactionId = null }) {
  const id = String(targetPoiId || '').trim();
  if (!id) return { ok: false, error: '缺少战略 POI 标识' };
  if (isBanditMapObjectId(id)) return { ok: true };
  const attFid = pvpCampAttackerFactionId != null ? String(pvpCampAttackerFactionId).trim() : '';
  if (attFid) {
    if (String(playerFactionId ?? '') === attFid) return { ok: true };
    return { ok: false, error: '仅攻方势力可移动至本方大本营' };
  }
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
 * @param {string} targetPoiId - 城池锚点 id、匪寨 **`banditPoiId`** 或 PVP **`pvpWarId`**
 * @param {number} mapColumns
 * @param {number} mapRows
 * @param {Array<{ pvpWarId?: string, pvp_war_id?: string, cells?: string[] }>|null|undefined} [pvpBaseCamps] - 仅当 `targetPoiId` 为战事 id 时用于 **`base_camp`** footprint（格上可无锚点）
 * @returns {{ keys: Set<string>, anchorGx: number, anchorGy: number, width: number, height: number, kind: 'city_2x2'|'bandit_domino'|'pvp_camp_domino', poiAnchorId?: string } | null}
 */
export function collectStrategicPoiFootprint(cells, targetPoiId, mapColumns, mapRows, pvpBaseCamps = null) {
  const id = String(targetPoiId || '').trim();
  if (!id || !cells?.length) return null;

  for (let gy = 0; gy < mapRows; gy++) {
    const row = cells[gy];
    if (!row) continue;
    for (let gx = 0; gx < mapColumns; gx++) {
      const cell = row[gx];
      const cellAnchor = readStrategicCellAnchorId(cell);
      if (!cellAnchor || cellAnchor !== id) continue;
      if (isCityPoiStrategicObject(cell.object)) {
        const keys = new Set();
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const x = gx + dx;
            const y = gy + dy;
            if (x < mapColumns && y < mapRows) keys.add(`${x},${y}`);
          }
        }
        const locJun = mapRows > STRATEGIC_COUNTY_MAP_ROWS ? playerRoadJunSliceFromWorldGy(gy) : null;
        const yOff = locJun ? stackWorldRowOffsetForJunId(locJun.junId) : 0;
        const localAnchorGy = locJun ? gy - yOff : gy;
        return {
          keys,
          anchorGx: gx,
          anchorGy: localAnchorGy,
          width: 2,
          height: 2,
          kind: 'city_2x2',
          poiAnchorId: id,
          poiPlayerRoadJunId: locJun?.junId ?? null,
          poiPlayerRoadLocalX: gx,
          poiPlayerRoadLocalY: localAnchorGy,
        };
      }
    }
  }

  if (isBanditMapObjectId(id)) {
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
        const cellAnchor = readStrategicCellAnchorId(cell);
        if (!cellAnchor || cellAnchor !== id) continue;
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
    const locJunB = mapRows > STRATEGIC_COUNTY_MAP_ROWS ? playerRoadJunSliceFromWorldGy(minY) : null;
    const yOffB = locJunB ? stackWorldRowOffsetForJunId(locJunB.junId) : 0;
    return {
      keys,
      anchorGx: minX,
      anchorGy: minY,
      width: w,
      height: h,
      kind: 'bandit_domino',
      poiAnchorId: id,
      poiPlayerRoadJunId: locJunB?.junId ?? null,
      poiPlayerRoadLocalX: minX,
      poiPlayerRoadLocalY: locJunB ? minY - yOffB : minY,
    };
  }

  if (isPvpWarMarchTargetId(id) && Array.isArray(pvpBaseCamps) && pvpBaseCamps.length) {
    const row = pvpBaseCamps.find((c) => String(c.pvpWarId ?? c.pvp_war_id ?? '').trim() === id);
    if (row?.cells?.length) return collectStrategicPvpCampFootprintFromBaseCamp(row, mapColumns, mapRows);
  }

  return null;
}

/**
 * @param {string} jj
 * @param {number} minWX
 * @param {number} minWY
 * @param {number} maxWX
 * @param {number} maxWY
 * @param {number} mapRows
 */
function buildPvpCampDominoFootprintFromWorldRect(jj, minWX, minWY, maxWX, maxWY, mapRows) {
  const w = maxWX - minWX + 1;
  const h = maxWY - minWY + 1;
  if (w * h !== 2 || (w !== 2 && h !== 2)) return null;
  const keys = new Set();
  for (let y = minWY; y <= maxWY; y++) {
    for (let x = minWX; x <= maxWX; x++) {
      keys.add(`${x},${y}`);
    }
  }
  const locJun = mapRows > STRATEGIC_COUNTY_MAP_ROWS ? playerRoadJunSliceFromWorldGy(minWY) : null;
  const yOff = locJun ? stackWorldRowOffsetForJunId(locJun.junId) : 0;
  return {
    keys,
    anchorGx: minWX,
    anchorGy: minWY,
    width: w,
    height: h,
    kind: 'pvp_camp_domino',
    poiPlayerRoadJunId: jj,
    poiPlayerRoadLocalX: minWX,
    poiPlayerRoadLocalY: locJun ? minWY - yOff : minWY,
  };
}

/**
 * 与 `pvpWarService.findBaseCampCandidatePlacements` 一致：贴城、不占路、**骨牌至少一格四邻接道路**；锚格 + 朝向决定郡内两格，再投到世界格。
 * 当 `base_camp.cells` 与锚点不同步时仍以锚点为准，避免「只点到延伸格 / 少一格」时 footprint 与瓦片 span 错位。
 *
 * @param {object} camp
 * @param {string} jj
 * @param {number} mapColumns
 * @param {number} mapRows
 */
function tryPvpCampFootprintFromAnchorOrientation(camp, jj, mapColumns, mapRows) {
  const oxRaw = camp.anchorOx ?? camp.anchor_ox;
  const oyRaw = camp.anchorOy ?? camp.anchor_oy;
  const aoX = Math.trunc(Number(oxRaw));
  const aoY = Math.trunc(Number(oyRaw));
  if (!Number.isFinite(aoX) || !Number.isFinite(aoY)) return null;
  const orient = String(camp.orientation || 'horizontal').toLowerCase();
  const vertical = orient === 'vertical';
  const locPairs = vertical
    ? [
        [aoX, aoY],
        [aoX, aoY + 1],
      ]
    : [
        [aoX, aoY],
        [aoX + 1, aoY],
      ];
  let minWX = Infinity;
  let minWY = Infinity;
  let maxWX = -Infinity;
  let maxWY = -Infinity;
  for (const [lx, ly] of locPairs) {
    if (lx < 0 || ly < 0 || lx >= mapColumns || ly >= STRATEGIC_COUNTY_MAP_ROWS) return null;
    const wCell = playerRoadToWorldMapCell(jj, lx, ly);
    if (!wCell) return null;
    const wy = wCell.worldGy;
    minWX = Math.min(minWX, lx);
    minWY = Math.min(minWY, wy);
    maxWX = Math.max(maxWX, lx);
    maxWY = Math.max(maxWY, wy);
  }
  return buildPvpCampDominoFootprintFromWorldRect(jj, minWX, minWY, maxWX, maxWY, mapRows);
}

/**
 * 服务端落库时写入的 **叠放世界格** `"gx,wy"`（与 `players.road_position` + 合并 `cells` 下标一致），
 * 优先于 `cells` 郡内坐标换算，避免 `junId` 滞后或重复换算导致 footprint 与真实瓦片错位。
 *
 * @param {object} camp
 * @param {number} mapColumns
 * @param {number} mapRows
 */
function tryPvpCampFootprintFromWorldCellKeys(camp, mapColumns, mapRows) {
  const raw = camp.worldCellKeys ?? camp.world_cell_keys;
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const jj = String(camp.junId || camp.jun_id || '').trim();
  if (!jj) return null;
  let minWX = Infinity;
  let minWY = Infinity;
  let maxWX = -Infinity;
  let maxWY = -Infinity;
  const keys = new Set();
  for (const k of raw) {
    const parts = String(k)
      .split(',')
      .map((s) => Number(String(s).trim()));
    const x = parts[0];
    const y = parts[1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < 0 || y < 0 || x >= mapColumns || y >= mapRows) return null;
    keys.add(`${x},${y}`);
    minWX = Math.min(minWX, x);
    minWY = Math.min(minWY, y);
    maxWX = Math.max(maxWX, x);
    maxWY = Math.max(maxWY, y);
  }
  if (keys.size !== 2) return null;
  return buildPvpCampDominoFootprintFromWorldRect(jj, minWX, minWY, maxWX, maxWY, mapRows);
}

/**
 * 仅从 `cells` 字符串列表包络得到 footprint（与历史实现一致）。
 *
 * @param {object} camp
 * @param {string} jj
 * @param {number} mapRows
 */
function tryPvpCampFootprintFromExplicitCells(camp, jj, mapRows) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const k of camp.cells) {
    const parts = String(k)
      .split(',')
      .map((s) => Number(String(s).trim()));
    const lx = parts[0];
    const ly = parts[1];
    if (!Number.isFinite(lx) || !Number.isFinite(ly)) continue;
    const wCell = playerRoadToWorldMapCell(jj, lx, ly);
    if (!wCell) continue;
    const wy = wCell.worldGy;
    any = true;
    minX = Math.min(minX, lx);
    minY = Math.min(minY, wy);
    maxX = Math.max(maxX, lx);
    maxY = Math.max(maxY, wy);
  }
  if (!any) return null;
  return buildPvpCampDominoFootprintFromWorldRect(jj, minX, minY, maxX, maxY, mapRows);
}

/**
 * PVP 攻方大本营：与匪寨同为 2×1 / 1×2 骨牌。
 * 优先 **`worldCellKeys`**（服务端落库的世界格 `"gx,wy"`）；否则 `base_camp.cells` 为郡内 `"gx,gy"` 再换世界行；
 * 再回退 `anchorOx/anchorOy` + `orientation`（与后端选位一致）。
 *
 * @param {object|null|undefined} camp - `wars_pvp.base_camp` JSON（可选 **`worldCellKeys`** 世界格、`cells` 郡内格、`junId`、锚点等）
 * @returns {{ keys: Set<string>, anchorGx: number, anchorGy: number, width: number, height: number, kind: 'pvp_camp_domino', poiPlayerRoadJunId: string|null, poiPlayerRoadLocalX: number, poiPlayerRoadLocalY: number } | null}
 */
export function collectStrategicPvpCampFootprintFromBaseCamp(camp, mapColumns, mapRows) {
  if (!camp) return null;
  const cols = Math.trunc(Number(mapColumns));
  const rows = Math.trunc(Number(mapRows));
  if (Number.isFinite(cols) && Number.isFinite(rows) && cols > 0 && rows > 0) {
    const fromWorld = tryPvpCampFootprintFromWorldCellKeys(camp, cols, rows);
    if (fromWorld) return fromWorld;
  }
  if (!Array.isArray(camp.cells) || !camp.cells.length) return null;
  const jidRaw = String(camp.junId || camp.jun_id || '').trim();
  const junCandidates = jidRaw ? [jidRaw] : [...SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER];

  for (const jid of junCandidates) {
    const jj = String(jid || '').trim();
    if (!jj) continue;
    const fromCells = tryPvpCampFootprintFromExplicitCells(camp, jj, mapRows);
    if (fromCells) return fromCells;
  }
  for (const jid of junCandidates) {
    const jj = String(jid || '').trim();
    if (!jj) continue;
    const fromAnchor = tryPvpCampFootprintFromAnchorOrientation(camp, jj, mapColumns, mapRows);
    if (fromAnchor) return fromAnchor;
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
 * @returns {{ keys: Set<string>, anchorGx: number, anchorGy: number, width: number, height: number, kind: string, poiAnchorId?: string } | null}
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
  const localRowCap =
    cellsFallback?.length > STRATEGIC_COUNTY_MAP_ROWS ? STRATEGIC_COUNTY_MAP_ROWS : mapRows;
  if (gx < 0 || gy < 0 || gx >= mapColumns || gy >= localRowCap) {
    if (cellsFallback?.length && id) {
      return collectStrategicPoiFootprint(cellsFallback, String(id), mapColumns, mapRows);
    }
    return null;
  }

  if (isBanditMapObjectId(id)) {
    if (cellsFallback?.length) {
      return collectStrategicPoiFootprint(cellsFallback, String(id), mapColumns, mapRows);
    }
    return null;
  }

  if (isAllowedPlayerCityPoiCityType(ct)) {
    const rowJun = String(
      cityRow?.jun_id ?? cityRow?.junId ?? cityRow?.JUN_ID ?? cityRow?.JUNID ?? '',
    ).trim();
    const useWorldKeys =
      !!cellsFallback?.length && cellsFallback.length > STRATEGIC_COUNTY_MAP_ROWS && !!rowJun;
    const yOff = useWorldKeys ? stackWorldRowOffsetForJunId(rowJun) : 0;
    const keys = new Set();
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = gx + dx;
        const wy = gy + dy + yOff;
        if (x >= 0 && x < mapColumns && wy >= 0 && wy < mapRows) keys.add(`${x},${wy}`);
      }
    }
    return {
      keys,
      anchorGx: gx,
      anchorGy: gy,
      width: 2,
      height: 2,
      kind: 'city_2x2',
      poiAnchorId: String(id).trim(),
      poiPlayerRoadJunId: rowJun || null,
      poiPlayerRoadLocalX: gx,
      poiPlayerRoadLocalY: gy,
    };
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

/**
 * 道路格中与「非道路」四邻的格子（道路子图嵌入网格的边界格）。
 * 用于：① 最短路途经禁穿边界（仅起点/终点可落位，与产品「不贴外缘跑」一致）；② 走廊深度（离该边界越远越「内道」）。
 */
export function computeRoadBoundaryKeys(roadPassable, mapColumns, mapRows) {
  const out = new Set();
  for (const k of roadPassable) {
    const [x, y] = k.split(',').map(Number);
    let touchesOffRoad = false;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= mapColumns || ny >= mapRows) {
        touchesOffRoad = true;
        break;
      }
      const nk = `${nx},${ny}`;
      if (!roadPassable.has(nk)) {
        touchesOffRoad = true;
        break;
      }
    }
    if (touchesOffRoad) out.add(k);
  }
  return out;
}

/**
 * 从所有道路边界格多源 BFS 向内填层数：边界为 0，越靠走廊内部数字越大（单格宽道路全为 0）。
 * @param {Set<string>} boundaryKeys - `computeRoadBoundaryKeys` 结果
 * @returns {Map<string, number>}
 */
export function computeRoadCorridorInwardDepth(roadPassable, boundaryKeys, mapColumns, mapRows) {
  const depth = new Map();
  const queue = [];
  for (const k of boundaryKeys) {
    if (!roadPassable.has(k)) continue;
    depth.set(k, 0);
    queue.push(k);
  }
  while (queue.length) {
    const k = queue.shift();
    const d = depth.get(k);
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= mapColumns || ny >= mapRows) continue;
      const nk = `${nx},${ny}`;
      if (!roadPassable.has(nk) || depth.has(nk)) continue;
      depth.set(nk, d + 1);
      queue.push(nk);
    }
  }
  return depth;
}

/**
 * 道路 BFS：四邻 `nk` 若为道路边界格，则仅当 `nk ∈ boundaryBypass` 时允许进入（用于「边界不可穿越、仅端点可落」）。
 */
function bfsRoadDistancesWithBoundaryBypass(roadPassable, boundaryKeys, seedKeys, boundaryBypass, mapColumns, mapRows) {
  const dist = new Map();
  const queue = [];
  const seeds = [...seedKeys].filter((sk) => roadPassable.has(sk));
  for (const sk of seeds) {
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
      if (boundaryKeys.has(nk) && !boundaryBypass.has(nk)) continue;
      dist.set(nk, d + 1);
      queue.push(nk);
    }
  }
  return dist;
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

function manhattanToCell(nx, ny, gx, gy) {
  return Math.abs(nx - gx) + Math.abs(ny - gy);
}

/**
 * 从 cur 沿最短路向起点方向退一步。
 * 在「distFrom 比 cur 浅 1」且落在 **某条** s→t 最短路上的邻格中选前驱。
 *
 * 平局：**道路走廊深度**（`computeRoadCorridorInwardDepth`：离「贴非道路」的道路边界越远越大）。
 * 曾用「离地图矩形边」距离，与道路外缘无关，易把部队线拽成贴道路边界/贴图边；已废弃。
 *
 * 过滤：优先排除「从更靠走廊内部的格走到更靠边界的外侧格」的一步（rdCur < c.rd）；若过滤后为空则回退接受全部最短路前驱。
 * 再按 rd 更大（更内道）、再按更靠近终点格 (endGx,endGy)、再按字典序。
 */
function pickPredecessorTowardStart(
  roadPassable,
  curKey,
  distFrom,
  distTo,
  mapColumns,
  mapRows,
  endGx,
  endGy,
  corridorDepth,
) {
  const depth = distFrom.get(curKey);
  if (depth == null || depth <= 0) return null;
  const rdCur = corridorDepth.get(curKey) ?? 0;

  /** @type {{ nk: string, dto: number, rd: number, manEnd: number }[]} */
  const onShortest = [];
  let minDto = Infinity;
  const [cx, cy] = curKey.split(',').map(Number);
  for (const [dx, dy] of DIRS4) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= mapColumns || ny >= mapRows) continue;
    const nk = `${nx},${ny}`;
    if (!roadPassable.has(nk)) continue;
    if (distFrom.get(nk) !== depth - 1) continue;
    const dto = distTo.get(nk);
    if (dto == null) continue;
    minDto = Math.min(minDto, dto);
    onShortest.push({
      nk,
      dto,
      rd: corridorDepth.get(nk) ?? 0,
      manEnd: manhattanToCell(nx, ny, endGx, endGy),
    });
  }
  if (!onShortest.length) return null;

  const sp = onShortest.filter((c) => c.dto === minDto);
  if (!sp.length) return null;

  const noBoundaryStep = sp.filter((c) => rdCur >= c.rd);
  const pool = noBoundaryStep.length ? noBoundaryStep : sp;

  let best = pool[0];
  for (let i = 1; i < pool.length; i++) {
    const c = pool[i];
    if (
      c.rd > best.rd ||
      (c.rd === best.rd && c.manEnd < best.manEnd) ||
      (c.rd === best.rd && c.manEnd === best.manEnd && c.nk < best.nk)
    ) {
      best = c;
    }
  }
  return best.nk;
}

function reconstructShortestPathGoalBiased(roadPassable, distFrom, distTo, endKey, mapColumns, mapRows) {
  if (!distFrom.has(endKey)) return null;
  const boundaryKeys = computeRoadBoundaryKeys(roadPassable, mapColumns, mapRows);
  const corridorDepth = computeRoadCorridorInwardDepth(roadPassable, boundaryKeys, mapColumns, mapRows);
  const [endGx, endGy] = endKey.split(',').map(Number);
  const keysRev = [endKey];
  let cur = endKey;
  while (distFrom.get(cur) > 0) {
    const pred = pickPredecessorTowardStart(
      roadPassable,
      cur,
      distFrom,
      distTo,
      mapColumns,
      mapRows,
      endGx,
      endGy,
      corridorDepth,
    );
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
  const boundaryKeys = computeRoadBoundaryKeys(roadPassable, mapColumns, mapRows);
  const bypass = new Set([startKey, endKey]);
  let distFrom = bfsRoadDistancesWithBoundaryBypass(roadPassable, boundaryKeys, [startKey], bypass, mapColumns, mapRows);
  let distTo;
  if (!distFrom.has(endKey)) {
    distFrom = bfsRoadDistances(roadPassable, [startKey], mapColumns, mapRows);
    distTo = bfsRoadDistances(roadPassable, [endKey], mapColumns, mapRows);
  } else {
    distTo = bfsRoadDistancesWithBoundaryBypass(roadPassable, boundaryKeys, [endKey], bypass, mapColumns, mapRows);
  }
  return reconstructShortestPathGoalBiased(roadPassable, distFrom, distTo, endKey, mapColumns, mapRows);
}

function multiSourceBfsShortest(roadPassable, startKeys, endKey, mapColumns, mapRows) {
  if (!roadPassable.has(endKey)) return null;
  const seeds = [...startKeys].filter((sk) => roadPassable.has(sk));
  if (!seeds.length) return null;
  const boundaryKeys = computeRoadBoundaryKeys(roadPassable, mapColumns, mapRows);
  const bypass = new Set([...seeds, endKey]);
  let distFrom = bfsRoadDistancesWithBoundaryBypass(roadPassable, boundaryKeys, seeds, bypass, mapColumns, mapRows);
  let distTo;
  if (!distFrom.has(endKey)) {
    distFrom = bfsRoadDistances(roadPassable, seeds, mapColumns, mapRows);
    distTo = bfsRoadDistances(roadPassable, [endKey], mapColumns, mapRows);
  } else {
    distTo = bfsRoadDistancesWithBoundaryBypass(roadPassable, boundaryKeys, [endKey], bypass, mapColumns, mapRows);
  }
  return reconstructShortestPathGoalBiased(roadPassable, distFrom, distTo, endKey, mapColumns, mapRows);
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
      const cid = readStrategicCellAnchorId(cell);
      if (!cid || seenIds.has(cid)) continue;
      seenIds.add(cid);
      const fp = collectStrategicPoiFootprint(cells, cid, mapColumns, mapRows);
      if (fp?.keys?.has(k0)) return fp.keys;
    }
  }
  return null;
}

/**
 * 合并图世界格 `(mergedGx, mergedGy)` 是否落在 PVP 攻方大本营 footprint 内（与 `collectStrategicPvpCampFootprintFromBaseCamp` 一致）。
 *
 * @param {number} mergedGy - 世界行（与 `cells` 下标一致）
 * @param {number} mergedGx - 世界列
 * @param {Array<{ junId?: string, cells?: string[], pvpWarId?: string, anchorOx?: number, anchorOy?: number, orientation?: string }>|null|undefined} pvpBaseCamps
 * @param {number} mapColumns - 与合并 `cells[0].length` 一致
 * @param {number} mapRows - 与 `cells.length` 一致
 * @returns {string} 非空则为 `pvpWarId`
 */
export function resolvePvpBaseCampWarIdAtMergedCell(mergedGy, mergedGx, pvpBaseCamps, mapColumns, mapRows) {
  if (!pvpBaseCamps?.length) return '';
  const ri = Math.trunc(Number(mergedGy));
  const ci = Math.trunc(Number(mergedGx));
  if (!Number.isFinite(ri) || !Number.isFinite(ci)) return '';
  const here = `${ci},${ri}`;
  const cols = Math.trunc(Number(mapColumns));
  const rows = Math.trunc(Number(mapRows));
  if (Number.isFinite(cols) && Number.isFinite(rows) && cols > 0 && rows > 0) {
    for (const c of pvpBaseCamps) {
      if (!c?.cells?.length) continue;
      const fp = collectStrategicPvpCampFootprintFromBaseCamp(c, cols, rows);
      if (fp?.keys?.has(here)) {
        const wid = String(c.pvpWarId || '').trim();
        if (wid) return wid;
      }
    }
    // 勿在此处 return：collect 与格网/郡字段偶发不同步时，须继续走下方按 cells+郡 的硬匹配（与 resolveStrategicTilePvpCampCover 第二段一致）。
  }
  for (const c of pvpBaseCamps) {
    if (!c?.cells?.length) continue;
    const jid = String(c.junId || c.jun_id || '').trim();
    const junCandidates = jid ? [jid] : [...SAN_1_STRATEGIC_VERTICAL_STACK_JUN_ORDER];
    let hit = false;
    outerJun: for (const jtry of junCandidates) {
      const jj = String(jtry || '').trim();
      if (!jj) continue;
      for (const k of c.cells) {
        const parts = String(k)
          .split(',')
          .map((s) => Number(String(s).trim()));
        const lx = parts[0];
        const ly = parts[1];
        if (!Number.isFinite(lx) || !Number.isFinite(ly)) continue;
        const wCell = playerRoadToWorldMapCell(jj, lx, ly);
        if (!wCell) continue;
        if (`${wCell.gx},${wCell.worldGy}` === here) {
          hit = true;
          break outerJun;
        }
      }
    }
    if (!hit) continue;
    const wid = String(c.pvpWarId || '').trim();
    if (wid) return wid;
  }
  return '';
}

/**
 * 合并战略格网坐标 `(mergedGx, mergedGy)`：玩家当前位置对应的 **可交互 POI 锚点**（城 2×2 / 匪寨骨牌；**非**道路格为默认）。
 * 与 `game/src/utils/strategicMapCityAnchor.js` 中 `resolveStrategicRecordedStandpointPx` 的「在路上 vs 离路入块 / 大本营 footprint」判定一致（该函数**不回退主城**，未命中则 `standpointError`）。
 * 坐标落在 **`roadCells` 可通行集**内 → 一般返回 `''`（贴城道路格不进面板）；
 * **例外**：库内 **城池 2×2 footprint** 仍包含该格时返回城 `city_id`（避免城块与路网重叠时「己方驻地」与按钮丢失）。
 *
 * @param {object[][]} cells
 * @param {{ gx: number, gy: number }[]|null|undefined} roadCells
 * @param {number} mapColumns
 * @param {number} mapRows
 * @param {number} mergedGx
 * @param {number} mergedGy
 * @param {object[]|null|undefined} citiesInCountyRows
 * @param {Array<{ junId?: string, cells?: string[], pvpWarId?: string }>|null|undefined} [pvpBaseCamps] — 仅在 **库内城/匪寨 footprint 未命中** 时再判大本营；缺 `junId` 时按豫州叠放郡序逐郡试算 `cells`（与 `resolveStrategicTilePvpCampCover` 一致）
 * @returns {string} 城池 `city_id`、匪寨 **`banditPoiId`** 或 **`pvpWarId`**；否则 `''`
 */
export function resolveMergedStandpointStrategicPoiAnchorId(
  cells,
  roadCells,
  mapColumns,
  mapRows,
  mergedGx,
  mergedGy,
  citiesInCountyRows,
  pvpBaseCamps = null,
) {
  if (!cells?.length) return '';
  const pass = buildRoadPassableKeySetForMarch(roadCells, cells, mapColumns, mapRows);
  const rx = Math.trunc(Number(mergedGx));
  const ry = Math.trunc(Number(mergedGy));
  if (!Number.isFinite(rx) || !Number.isFinite(ry)) return '';
  if (pass.has(`${rx},${ry}`)) {
    // 城 2×2 内格若仍落在 `roadCells` 可通行集（叠图/数据偏差），早退 `''` 会使「己方驻地」与三公府/驻军所按钮并存失败（典型：颍川阳翟）。
    if (Array.isArray(citiesInCountyRows) && citiesInCountyRows.length) {
      const fpRoad = resolvePoiFootprintAtCellFromDb(citiesInCountyRows, rx, ry, mapColumns, mapRows, cells);
      const roadPid =
        fpRoad?.poiAnchorId != null && String(fpRoad.poiAnchorId).trim() !== ''
          ? String(fpRoad.poiAnchorId).trim()
          : '';
      if (roadPid && fpRoad.kind === 'city_2x2' && !isBanditMapObjectId(roadPid)) {
        return roadPid;
      }
    }
    // 库 position 与合并 cells 城块错位时 DB 不命中；仍须从格网解析「落在城内可通行格」的城锚点（与 off-road 分支一致）。
    const fpKeysRoad = findPoiFootprintKeysContainingCell(cells, rx, ry, mapColumns, mapRows);
    if (fpKeysRoad?.size) {
      let poiIdRoad = '';
      for (const fk of fpKeysRoad) {
        const [gx2, gy2] = fk.split(',').map(Number);
        const c2 = cells[gy2]?.[gx2];
        const aid2 = readStrategicCellAnchorId(c2);
        if (aid2) {
          poiIdRoad = String(aid2).trim();
          break;
        }
      }
      if (poiIdRoad && !isBanditMapObjectId(poiIdRoad)) {
        const fpCellRoad = collectStrategicPoiFootprint(cells, poiIdRoad, mapColumns, mapRows);
        const kRoad = `${rx},${ry}`;
        if (
          fpCellRoad?.kind === 'city_2x2' &&
          fpCellRoad.keys?.has(kRoad) &&
          fpCellRoad.poiAnchorId
        ) {
          return String(fpCellRoad.poiAnchorId).trim();
        }
      }
    }
    return '';
  }

  let fp = null;
  if (Array.isArray(citiesInCountyRows) && citiesInCountyRows.length) {
    fp = resolvePoiFootprintAtCellFromDb(citiesInCountyRows, rx, ry, mapColumns, mapRows, cells);
  }
  if (!fp) {
    const fpKeys = findPoiFootprintKeysContainingCell(cells, rx, ry, mapColumns, mapRows);
    if (fpKeys?.size) {
      let poiId = '';
      for (const fk of fpKeys) {
        const [gx, gy] = fk.split(',').map(Number);
        const c = cells[gy]?.[gx];
        const aid = readStrategicCellAnchorId(c);
        if (aid) {
          poiId = String(aid);
          break;
        }
      }
      if (poiId) {
        fp = collectStrategicPoiFootprint(cells, poiId, mapColumns, mapRows);
      }
    }
  }
  if (fp?.keys?.size) {
    const pid =
      fp.poiAnchorId != null && String(fp.poiAnchorId).trim() !== ''
        ? String(fp.poiAnchorId).trim()
        : '';
    if (pid) return pid;
    for (const fk of fp.keys) {
      const [gx, gy] = fk.split(',').map(Number);
      const c = cells[gy]?.[gx];
      const aid = readStrategicCellAnchorId(c);
      if (aid) return String(aid).trim();
    }
  }
  const cellDirect = cells[ry]?.[rx];
  const directAid = readStrategicCellAnchorId(cellDirect);
  if (directAid) {
    const d = String(directAid).trim();
    if (d) return d;
  }
  const pvpWarStanding = resolvePvpBaseCampWarIdAtMergedCell(ry, rx, pvpBaseCamps, mapColumns, mapRows);
  if (pvpWarStanding) return pvpWarStanding;
  return '';
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
 * profile API（camelCase）与 DB 行（snake_case）两用的道路立点字段。
 * @param {object|null|undefined} player
 * @returns {{ roadJunId: string|null, roadPositionX: number, roadPositionY: number }}
 */
export function playerRoadStandFromProfile(player) {
  if (!player || typeof player !== 'object') {
    return { roadJunId: null, roadPositionX: NaN, roadPositionY: NaN };
  }
  const rawJun = player.roadJunId ?? player.road_jun_id ?? null;
  const roadJunId =
    rawJun != null && String(rawJun).trim() ? String(rawJun).trim() : null;
  const roadPositionX = Number(player.roadPositionX ?? player.road_position_x);
  const roadPositionY = Number(player.roadPositionY ?? player.road_position_y);
  return { roadJunId, roadPositionX, roadPositionY };
}

/**
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
 * 离路时沿路出发/首跳：**仅** `road_position` 命中的已知 POI 占格 — PVP 攻方大本营、库城 DB footprint、格网城寨。
 * **禁止**以 `main_city_id` / 主城格网作回退；未命中返回空 `Set`，由调用方显式报错。
 * @param {object} [poiOptions]
 * @param {object[]|null|undefined} [poiOptions.citiesInCountyRows]
 * @param {Array<{ junId?: string, cells?: string[], pvpWarId?: string }>|null|undefined} [poiOptions.pvpBaseCamps]
 * @returns {Set<string>}
 */
export function resolveOffRoadMarchDepartureFootprintKeys(
  cells,
  player,
  countyJunId,
  mapColumns,
  mapRows,
  poiOptions = {},
  useWorldStackRoadCoords = false,
) {
  const { citiesInCountyRows = null, pvpBaseCamps = null } = poiOptions || {};

  const { roadJunId: roadJun, roadPositionX: rx, roadPositionY: ry } = playerRoadStandFromProfile(player);
  /** 单郡图：坐标属 `road_jun_id` 本地格，须 `roadJun === countyJunId`；豫州叠放合并格网用世界行，允许 `road_jun_id` 为汝南而 `countyJunId` 为颍川等（与 `buildMarchPath` 起点一致）。 */
  const canProbePlayerCell =
    Number.isFinite(rx) &&
    Number.isFinite(ry) &&
    !!String(roadJun || '').trim() &&
    (useWorldStackRoadCoords ? true : String(roadJun).trim() === String(countyJunId || '').trim());
  if (canProbePlayerCell) {
    const probeWorld = playerRoadToWorldMapCell(roadJun, rx, ry);
    const wx = probeWorld?.gx ?? Math.trunc(rx);
    const wyProbe = probeWorld?.worldGy ?? Math.trunc(ry);
    // 大本营须优先于库城 footprint：否则 `road_position` 与某城 DB 框重叠时会误用错误 POI 邻路出发。
    if (Array.isArray(pvpBaseCamps) && pvpBaseCamps.length) {
      const wid = resolvePvpBaseCampWarIdAtMergedCell(wyProbe, wx, pvpBaseCamps, mapColumns, mapRows);
      if (wid) {
        const camp = pvpBaseCamps.find((c) => String(c?.pvpWarId || '').trim() === wid);
        if (camp) {
          const fpCamp = collectStrategicPvpCampFootprintFromBaseCamp(camp, mapColumns, mapRows);
          if (fpCamp?.keys?.size) return fpCamp.keys;
        }
      }
    }
    let poiFp = null;
    if (Array.isArray(citiesInCountyRows) && citiesInCountyRows.length) {
      poiFp = findPoiFootprintKeysContainingCellFromDb(
        citiesInCountyRows,
        wx,
        wyProbe,
        mapColumns,
        mapRows,
        cells,
      );
    }
    if (!poiFp?.size) {
      poiFp = findPoiFootprintKeysContainingCell(cells, wx, wyProbe, mapColumns, mapRows);
    }
    if (poiFp?.size) return poiFp;
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
 * POI 入城/寨后写库用：锚格为 **郡内** `road_position_*`，并须带 **`road_jun_id`**（叠放寻路时 footprint 已用世界行键）。
 * @param {object|null|undefined} targetCityDbRow - `buildMarchPathToStrategicPoi` 的库城行（含 `jun_id` / `junId`）
 * @param {object[]|null|undefined} citiesInCountyRows - 多郡合并查询时可反查 `jun_id`
 */
function buildPoiPlayerRoadWriteSnap(poi, targetCityDbRow = null, citiesInCountyRows = null) {
  if (!poi || !Number.isFinite(poi.anchorGx) || !Number.isFinite(poi.anchorGy)) {
    return { poiAnchor: null, poiAnchorJunId: null };
  }
  const localX =
    poi.poiPlayerRoadLocalX != null && Number.isFinite(Number(poi.poiPlayerRoadLocalX))
      ? Math.trunc(Number(poi.poiPlayerRoadLocalX))
      : Math.trunc(poi.anchorGx);
  const localY =
    poi.poiPlayerRoadLocalY != null && Number.isFinite(Number(poi.poiPlayerRoadLocalY))
      ? Math.trunc(Number(poi.poiPlayerRoadLocalY))
      : Math.trunc(poi.anchorGy);
  let junId = String(poi.poiPlayerRoadJunId || '').trim();
  if (!junId && targetCityDbRow) {
    junId = String(
      targetCityDbRow.jun_id ?? targetCityDbRow.junId ?? targetCityDbRow.JUN_ID ?? '',
    ).trim();
  }
  const poiCid = String(poi.poiAnchorId || '').trim();
  if (!junId && poiCid && Array.isArray(citiesInCountyRows) && citiesInCountyRows.length) {
    const hit = citiesInCountyRows.find((r) => String(r.city_id ?? r.cityId ?? '').trim() === poiCid);
    junId = String(hit?.jun_id ?? hit?.junId ?? '').trim();
  }
  const cid =
    targetCityDbRow != null
      ? String(targetCityDbRow.city_id ?? targetCityDbRow.cityId ?? targetCityDbRow.id ?? '').trim()
      : '';
  if (!junId && cid && Array.isArray(citiesInCountyRows) && citiesInCountyRows.length) {
    const hit = citiesInCountyRows.find((r) => String(r.city_id ?? r.cityId ?? '').trim() === cid);
    junId = String(hit?.jun_id ?? hit?.junId ?? '').trim();
  }
  if (junId) {
    return {
      poiAnchor: { x: localX, y: localY },
      poiAnchorJunId: junId,
    };
  }
  return { poiAnchor: { x: localX, y: localY }, poiAnchorJunId: null };
}

/**
 * 战略 POI 行军：终点城/匪寨/攻方大本营；离路出发仅 {@link resolveOffRoadMarchDepartureFootprintKeys}（**不以主城替代**）。
 */
export function buildMarchPathToStrategicPoi({
  cells,
  roadCells,
  mapColumns,
  mapRows,
  countyJunId,
  player,
  targetPoiId,
  targetCityDbRow = null,
  citiesInCountyRows = null,
  hostileOccupiedRoadKeys = null,
  useWorldStackRoadCoords = false,
  /** `wars_pvp.base_camp` 对象：行军终点为攻方大本营时由调用方传入（与匪寨同为骨牌 footprint） */
  pvpCampBaseCamp = null,
  /** 活跃战事大本营列表（与战略格 `pvpBaseCamps` 同源）：离路出发时解析 **当前立点** 是否在大本营 footprint 内 */
  pvpBaseCamps = null,
}) {
  if (!cells?.length || !roadCells?.length) {
    return { ok: false, error: '当前地图缺少道路数据' };
  }
  const roadPassable = buildRoadPassableKeySetForMarch(roadCells, cells, mapColumns, mapRows);
  /* 保留入参以兼容旧调用；寻路不再剔除敌对占格。 */
  void hostileOccupiedRoadKeys;
  /** 与匪寨一致：`targetPoiId` 为 PVP 战事且带 `baseCamp` 时 **仅** 用大本营 footprint，禁止回退到 `cities` 城心（否则表现为「点大本营却寻路到目标城」）。 */
  const isPvpCampMarch =
    !!(pvpCampBaseCamp && Array.isArray(pvpCampBaseCamp.cells) && pvpCampBaseCamp.cells.length);
  if (isPvpWarMarchTargetId(targetPoiId) && !isPvpCampMarch) {
    return {
      ok: false,
      error:
        '该目标为 PVP 战事但未携带攻方大本营（baseCamp），无法寻路；请刷新战事列表后重试（不得以城心替代）。',
    };
  }
  let poi = null;
  if (isPvpCampMarch) {
    poi = collectStrategicPvpCampFootprintFromBaseCamp(pvpCampBaseCamp, mapColumns, mapRows);
    if (!poi?.keys?.size) {
      return {
        ok: false,
        error: '攻方大本营 footprint 无法解析（请核对 wars_pvp.base_camp 与合并地图叠放）',
      };
    }
  } else {
    if (targetCityDbRow) {
      poi = buildStrategicPoiFootprintFromDbCityRow(targetCityDbRow, mapColumns, mapRows, cells);
    }
    if (!poi?.keys?.size) {
      poi = collectStrategicPoiFootprint(cells, targetPoiId, mapColumns, mapRows);
    }
  }
  if (!poi?.keys?.size) {
    return { ok: false, error: '目标战略点不在当前郡格网内' };
  }
  const adjRoad = roadKeysAdjacentOrDiagonalToFootprint(poi.keys, roadPassable);
  if (!adjRoad.size) {
    return { ok: false, error: '目标旁无可用道路格，无法接近' };
  }

  const { roadJunId: roadJun, roadPositionX: rx, roadPositionY: ry } = playerRoadStandFromProfile(player);
  const startWorld = playerRoadToWorldMapCell(roadJun, rx, ry);
  const startWy = startWorld?.worldGy ?? Math.trunc(ry);
  const canUseStartKeyRoad =
    Number.isFinite(rx) &&
    Number.isFinite(ry) &&
    !!String(roadJun || '').trim() &&
    (useWorldStackRoadCoords ? true : String(roadJun).trim() === String(countyJunId || '').trim());
  const startKeyIfRoad = canUseStartKeyRoad ? `${Math.trunc(rx)},${startWy}` : null;
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
      { citiesInCountyRows, pvpBaseCamps: pvpBaseCamps ?? null },
      useWorldStackRoadCoords,
    );
    if (!footprintKeys.size) {
      return {
        ok: false,
        error:
          '离路起点无法解析：当前坐标须落在库城/格网城寨/PVP 攻方大本营等已登记 POI 占格内（不以主城替代）。请刷新地图或核对 road_position。',
      };
    }
    const starts = roadKeysAdjacentToFootprint(footprintKeys, roadPassable);
    if (!starts.size) return { ok: false, error: '出发地旁没有可通行的道路格' };
    path = pickNearestRoadTargetMultiStart(roadPassable, starts, adjRoad, mapColumns, mapRows);
  }

  if (!path?.length) return { ok: false, error: '无法沿道路到达目标邻近道路格' };

  const snap = buildPoiPlayerRoadWriteSnap(poi, targetCityDbRow, citiesInCountyRows);
  return {
    ok: true,
    path,
    onRoadAtStart: !!onRoadCell,
    poiAnchor: snap.poiAnchor,
    poiAnchorJunId: snap.poiAnchorJunId,
    targetPoiId: String(targetPoiId),
  };
}
