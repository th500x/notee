/**
 * 战略大地图：在合并格网中解析城/匪寨 POI 锚点与「自身标记」立点像素（城 `cityId`、匪寨 `banditPoiId`，见 `readStrategicCellAnchorId`）。
 */

import { strategicMapObjectIs2x2 } from '@/utils/mapTileVisualAssets';
import { readStrategicCellAnchorId } from '@shared/utils/strategicCellAnchorId.js';
import {
  buildRoadPassableKeySetForMarch,
  collectStrategicPoiFootprint,
  collectStrategicPvpCampFootprintFromBaseCamp,
  findPoiFootprintKeysContainingCell,
  resolvePoiFootprintAtCellFromDb,
  resolvePvpBaseCampWarIdAtMergedCell,
} from '@shared/utils/strategicMarchPoi.js';
import { readJunBattlefieldAtGrid } from '@shared/utils/junBattlefieldCell.js';

/** 非 Meowa 格网 CSS `gap`（`.ws-map-grid`）；Meowa 底板模式为 0（`.ws-map-grid--meowa-underlay`） */
export const STRATEGIC_MAP_GRID_GAP_PX = 1;

function normalizeGridGapPx(gapPx) {
  const g = Number(gapPx);
  return Number.isFinite(g) && g >= 0 ? g : STRATEGIC_MAP_GRID_GAP_PX;
}

/** 路点与合并格网/POI 数据无法对齐（非静默；勿再回退主城） */
export const STRATEGIC_STANDPOINT_ERROR = {
  NO_GRID: 'STRATEGIC_STANDPOINT_NO_GRID',
  INVALID_COORDS: 'STRATEGIC_STANDPOINT_INVALID_COORDS',
  UNRESOLVED_OFF_ROAD: 'STRATEGIC_STANDPOINT_UNRESOLVED_OFF_ROAD',
};

/**
 * 合并格 `cells` 已就绪，但城表 / PVP 大本营列表仍在首屏拉取中：此时离路立点解析可能误报 `UNRESOLVED_OFF_ROAD`（如 Tab 切回大地图瞬间）。
 * @param {{ cells?: object[][]|null, cityLoadState?: string, pvpBaseCampsLoadState?: string }} p
 */
export function isStrategicStandpointPoiDepsPending({
  cells,
  cityLoadState = 'idle',
  pvpBaseCampsLoadState = 'loading',
}) {
  if (!cells?.length) return true;
  if (cityLoadState === 'idle' || cityLoadState === 'loading') return true;
  if (pvpBaseCampsLoadState === 'loading') return true;
  return false;
}

export function strategicStandpointErrorMessage(code) {
  switch (code) {
    case STRATEGIC_STANDPOINT_ERROR.NO_GRID:
      return '战略地图未加载，无法解析路点';
    case STRATEGIC_STANDPOINT_ERROR.INVALID_COORDS:
      return '路点坐标无效，请刷新或重新登录';
    case STRATEGIC_STANDPOINT_ERROR.UNRESOLVED_OFF_ROAD:
      return '路点落在无效格（非道路/城/寨/大本营/战场入口），正在尝试自动移至郡战场…';
    default:
      return code ? String(code) : '路点解析失败';
  }
}

/**
 * 叠放大地图上 POI footprint 的 `keys` 为世界行 `gy`，而 `buildStrategicPoiFootprintFromDbCityRow` 的
 * `anchorGx/anchorGy` 仍为库内郡坐标左上。像素/滚动须用 **keys 中 (gy,x) 字典序最小** 的格作为合并网左上，
 * 否则汝南城会被画到颍川条带（本地行号被当成世界行）。
 * @param {{ keys?: Set<string>, anchorGx: number, anchorGy: number }} fp
 * @returns {{ gx: number, gy: number }}
 */
function mergedGridTopLeftFromFootprint(fp) {
  if (!fp?.keys?.size) {
    return { gx: Math.trunc(Number(fp?.anchorGx) || 0), gy: Math.trunc(Number(fp?.anchorGy) || 0) };
  }
  let bestX = Infinity;
  let bestY = Infinity;
  for (const k of fp.keys) {
    const [x, y] = String(k).split(',').map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (y < bestY || (y === bestY && x < bestX)) {
      bestY = y;
      bestX = x;
    }
  }
  if (!Number.isFinite(bestX) || !Number.isFinite(bestY)) {
    return { gx: Math.trunc(Number(fp.anchorGx) || 0), gy: Math.trunc(Number(fp.anchorGy) || 0) };
  }
  return { gx: bestX, gy: bestY };
}

/**
 * @param {object[][]|null|undefined} cells
 * @param {string|null|undefined} mainCityId - `players.main_city_id` / `cities.city_id`
 * @returns {{ anchorR: number, anchorC: number, footprint: '2x2' | '1x1' } | null}
 */
export function findStrategicCityAnchorForMainCity(cells, mainCityId) {
  const id = String(mainCityId || '').trim();
  if (!id || !cells?.length) return null;

  for (let ri = 0; ri < cells.length; ri++) {
    const row = cells[ri];
    if (!row) continue;
    for (let ci = 0; ci < row.length; ci++) {
      const cell = row[ci];
      if (!cell?.cityId || String(cell.cityId) !== id) continue;
      if (strategicMapObjectIs2x2(cell?.object)) {
        return { anchorR: ri, anchorC: ci, footprint: '2x2' };
      }
    }
  }

  for (let ri = 0; ri < cells.length; ri++) {
    const row = cells[ri];
    if (!row) continue;
    for (let ci = 0; ci < row.length; ci++) {
      const cell = row[ci];
      if (cell?.cityId && String(cell.cityId) === id) {
        return { anchorR: ri, anchorC: ci, footprint: '1x1' };
      }
    }
  }

  return null;
}

/**
 * 城市块中心在 `.ws-map-shell` 内的像素坐标（须与当前格网 CSS `gap` 一致）。
 * @param {{ anchorR: number, anchorC: number, footprint: '2x2' | '1x1' }} anchor
 * @param {number} tilePx
 * @param {number} [gapPx=STRATEGIC_MAP_GRID_GAP_PX]
 * @returns {{ cx: number, cy: number }}
 */
export function strategicCityBlockCenterPx(anchor, tilePx, gapPx = STRATEGIC_MAP_GRID_GAP_PX) {
  const t = Number(tilePx) || 0;
  const gap = normalizeGridGapPx(gapPx);
  const stride = t + gap;
  const span = anchor.footprint === '2x2' ? 2 * t + gap : t;
  const { anchorC, anchorR } = anchor;
  return {
    cx: anchorC * stride + span / 2,
    cy: anchorR * stride + span / 2,
  };
}

/**
 * 道路格 / 郡战场入口等（1×1）格心在 `.ws-map-shell` 内的像素坐标。
 * @param {number} gx
 * @param {number} gy
 * @param {number} tilePx
 * @param {number} [gapPx=STRATEGIC_MAP_GRID_GAP_PX] Meowa 底板须传 `0`
 * @returns {{ cx: number, cy: number }}
 */
export function strategicRoadCellCenterPx(gx, gy, tilePx, gapPx = STRATEGIC_MAP_GRID_GAP_PX) {
  const t = Number(tilePx) || 0;
  const gap = normalizeGridGapPx(gapPx);
  const stride = t + gap;
  return {
    cx: gx * stride + t / 2,
    cy: gy * stride + t / 2,
  };
}

/**
 * 城心 / 匪寨（1×2 或 2×1 或 2×2）块几何中心像素；`anchorR/anchorC` 为占位 **左上** 格（gy / gx）。
 * @param {{ anchorR: number, anchorC: number, width: number, height: number }} geo
 * @param {number} tilePx
 * @param {number} [gapPx=STRATEGIC_MAP_GRID_GAP_PX]
 */
export function strategicPoiBlockCenterPx(geo, tilePx, gapPx = STRATEGIC_MAP_GRID_GAP_PX) {
  const t = Number(tilePx) || 0;
  const gap = normalizeGridGapPx(gapPx);
  const stride = t + gap;
  const spanW = geo.width === 2 ? 2 * t + gap : t;
  const spanH = geo.height === 2 ? 2 * t + gap : t;
  return {
    cx: geo.anchorC * stride + spanW / 2,
    cy: geo.anchorR * stride + spanH / 2,
  };
}

/**
 * 根据 `players.road_*` 与合并格网，解算大地图叠层像素中心（道路格心 / 离路城寨块心 / 攻方大本营骨牌心）。
 * 已移除「回退主城」：离路且无法命中任何已知 POI footprint 时返回 `standpointError`，由 UI 显式提示。
 * @returns {{ cx: number|null, cy: number|null, onRoadCell: boolean, standpointError: string|null }}
 */
export function resolveStrategicRecordedStandpointPx({
  cells,
  roadCells,
  mapColumns,
  mapRows,
  countyJunId: _countyJunId,
  tilePx,
  /** 与 `.ws-map-grid` CSS gap 对齐；Meowa 底板为 0 */
  gridGapPx = STRATEGIC_MAP_GRID_GAP_PX,
  playerRoadJunId: _playerRoadJunId,
  roadX,
  roadY,
  citiesInCountyRows = null,
  pvpBaseCamps = null,
}) {
  if (!cells?.length) {
    return { cx: null, cy: null, onRoadCell: false, standpointError: STRATEGIC_STANDPOINT_ERROR.NO_GRID };
  }
  const gap = normalizeGridGapPx(gridGapPx);
  const pass = buildRoadPassableKeySetForMarch(roadCells, cells, mapColumns, mapRows);
  const rx = Number(roadX);
  const ry = Number(roadY);
  /** 合并格网为郡内统一坐标；`road_jun_id` 可与当前视图 `countyJunId` 不同（邻郡城仍在同一 merged cells 内） */
  const startKey =
    Number.isFinite(rx) && Number.isFinite(ry) ? `${Math.trunc(rx)},${Math.trunc(ry)}` : null;
  if (!startKey) {
    return {
      cx: null,
      cy: null,
      onRoadCell: false,
      standpointError: STRATEGIC_STANDPOINT_ERROR.INVALID_COORDS,
    };
  }
  const onRoadCell = pass.has(startKey);
  if (onRoadCell) {
    return {
      ...strategicRoadCellCenterPx(rx, ry, tilePx, gap),
      onRoadCell: true,
      standpointError: null,
    };
  }
  /** 郡战场入口：可立足（与档案修复 / 31-1 一致；可不在 roadCells 上）；1×1 格心 */
  if (readJunBattlefieldAtGrid(cells, Math.trunc(rx), Math.trunc(ry))) {
    return {
      ...strategicRoadCellCenterPx(rx, ry, tilePx, gap),
      onRoadCell: false,
      standpointError: null,
    };
  }
  let fp = null;
  if (Array.isArray(citiesInCountyRows) && citiesInCountyRows.length) {
    fp = resolvePoiFootprintAtCellFromDb(
      citiesInCountyRows,
      Math.trunc(rx),
      Math.trunc(ry),
      mapColumns,
      mapRows,
      cells,
    );
  }
  if (!fp) {
    const fpKeys = findPoiFootprintKeysContainingCell(cells, Math.trunc(rx), Math.trunc(ry), mapColumns, mapRows);
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
  if (fp) {
    const tl = mergedGridTopLeftFromFootprint(fp);
    return {
      ...strategicPoiBlockCenterPx(
        { anchorR: tl.gy, anchorC: tl.gx, width: fp.width, height: fp.height },
        tilePx,
        gap,
      ),
      onRoadCell: false,
      standpointError: null,
    };
  }
  if (Array.isArray(pvpBaseCamps) && pvpBaseCamps.length) {
    const wid = resolvePvpBaseCampWarIdAtMergedCell(
      Math.trunc(ry),
      Math.trunc(rx),
      pvpBaseCamps,
      mapColumns,
      mapRows,
    );
    if (wid) {
      const camp = pvpBaseCamps.find((c) => String(c?.pvpWarId || '').trim() === wid);
      if (camp) {
        const fpCamp = collectStrategicPvpCampFootprintFromBaseCamp(camp, mapColumns, mapRows);
        if (fpCamp?.keys?.size) {
          const tl = mergedGridTopLeftFromFootprint(fpCamp);
          return {
            ...strategicPoiBlockCenterPx(
              { anchorR: tl.gy, anchorC: tl.gx, width: fpCamp.width, height: fpCamp.height },
              tilePx,
              gap,
            ),
            onRoadCell: false,
            standpointError: null,
          };
        }
      }
    }
  }
  return {
    cx: null,
    cy: null,
    onRoadCell: false,
    standpointError: STRATEGIC_STANDPOINT_ERROR.UNRESOLVED_OFF_ROAD,
  };
}

/**
 * 与 `resolveStrategicRecordedStandpointPx` 同语义；已移除主城回退。
 * @returns {{ gx: number, gy: number, error: null } | { gx: null, gy: null, error: string }}
 */
export function resolveStrategicRecordedStandpointCell({
  cells,
  roadCells,
  mapColumns,
  mapRows,
  countyJunId: _countyJunId,
  playerRoadJunId: _playerRoadJunId,
  roadX,
  roadY,
  citiesInCountyRows = null,
  pvpBaseCamps = null,
}) {
  if (!cells?.length) {
    return { gx: null, gy: null, error: STRATEGIC_STANDPOINT_ERROR.NO_GRID };
  }
  const pass = buildRoadPassableKeySetForMarch(roadCells, cells, mapColumns, mapRows);
  const rx = Number(roadX);
  const ry = Number(roadY);
  const startKey =
    Number.isFinite(rx) && Number.isFinite(ry) ? `${Math.trunc(rx)},${Math.trunc(ry)}` : null;
  if (!startKey) {
    return { gx: null, gy: null, error: STRATEGIC_STANDPOINT_ERROR.INVALID_COORDS };
  }
  const onRoadCell = pass.has(startKey);
  if (onRoadCell) {
    return { gx: Math.trunc(rx), gy: Math.trunc(ry), error: null };
  }
  if (readJunBattlefieldAtGrid(cells, Math.trunc(rx), Math.trunc(ry))) {
    return { gx: Math.trunc(rx), gy: Math.trunc(ry), error: null };
  }
  let fp = null;
  if (Array.isArray(citiesInCountyRows) && citiesInCountyRows.length) {
    fp = resolvePoiFootprintAtCellFromDb(
      citiesInCountyRows,
      Math.trunc(rx),
      Math.trunc(ry),
      mapColumns,
      mapRows,
      cells,
    );
  }
  if (!fp) {
    const fpKeys = findPoiFootprintKeysContainingCell(cells, Math.trunc(rx), Math.trunc(ry), mapColumns, mapRows);
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
  if (fp) {
    const tl = mergedGridTopLeftFromFootprint(fp);
    return { gx: tl.gx, gy: tl.gy, error: null };
  }
  if (Array.isArray(pvpBaseCamps) && pvpBaseCamps.length) {
    const wid = resolvePvpBaseCampWarIdAtMergedCell(
      Math.trunc(ry),
      Math.trunc(rx),
      pvpBaseCamps,
      mapColumns,
      mapRows,
    );
    if (wid) {
      const camp = pvpBaseCamps.find((c) => String(c?.pvpWarId || '').trim() === wid);
      if (camp) {
        const fpCamp = collectStrategicPvpCampFootprintFromBaseCamp(camp, mapColumns, mapRows);
        if (fpCamp?.keys?.size) {
          const tl = mergedGridTopLeftFromFootprint(fpCamp);
          return { gx: tl.gx, gy: tl.gy, error: null };
        }
      }
    }
  }
  return { gx: null, gy: null, error: STRATEGIC_STANDPOINT_ERROR.UNRESOLVED_OFF_ROAD };
}
