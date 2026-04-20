/**
 * 战略大地图：根据 `city_id` 在合并格网中查找城市锚点格，供「自身标记」等与格心像素对齐。
 */

import { strategicMapObjectIs2x2 } from '@/utils/campaignMapVisualAssets';
import {
  buildRoadPassableKeySetForMarch,
  collectStrategicPoiFootprint,
  findPoiFootprintKeysContainingCell,
  buildStrategicPoiFootprintFromDbCityRow,
  resolvePoiFootprintAtCellFromDb,
} from '@shared/utils/strategicMarchPoi.js';

const GAP_PX = 1;

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
 * 城市块中心在 `.ws-map-shell` 内的像素坐标（与 `.ws-map-grid` gap:1px、2×2 占地 `2*tile+1` 一致）。
 * @param {{ anchorR: number, anchorC: number, footprint: '2x2' | '1x1' }} anchor
 * @param {number} tilePx
 * @returns {{ cx: number, cy: number }}
 */
export function strategicCityBlockCenterPx(anchor, tilePx) {
  const t = Number(tilePx) || 0;
  const stride = t + GAP_PX;
  const span = anchor.footprint === '2x2' ? 2 * t + GAP_PX : t;
  const { anchorC, anchorR } = anchor;
  return {
    cx: anchorC * stride + span / 2,
    cy: anchorR * stride + span / 2,
  };
}

/**
 * 道路格（1×1）格心在 `.ws-map-shell` 内的像素坐标；用于玩家沿路 pawn 的立点。
 * @param {number} gx
 * @param {number} gy
 * @param {number} tilePx
 * @returns {{ cx: number, cy: number }}
 */
export function strategicRoadCellCenterPx(gx, gy, tilePx) {
  const t = Number(tilePx) || 0;
  const stride = t + GAP_PX;
  return {
    cx: gx * stride + t / 2,
    cy: gy * stride + t / 2,
  };
}

/**
 * 城心 / 匪寨（1×2 或 2×1 或 2×2）块几何中心像素；`anchorR/anchorC` 为占位 **左上** 格（gy / gx）。
 * @param {{ anchorR: number, anchorC: number, width: number, height: number }} geo
 */
export function strategicPoiBlockCenterPx(geo, tilePx) {
  const t = Number(tilePx) || 0;
  const stride = t + GAP_PX;
  const spanW = geo.width === 2 ? 2 * t + GAP_PX : t;
  const spanH = geo.height === 2 ? 2 * t + GAP_PX : t;
  return {
    cx: geo.anchorC * stride + spanW / 2,
    cy: geo.anchorR * stride + spanH / 2,
  };
}

/**
 * 根据 `players.road_*` 与合并格网，解算大地图叠层像素中心（道路格心 / 离路城寨块心 / 主城块心）。
 */
export function resolveStrategicRecordedStandpointPx({
  cells,
  roadCells,
  mapColumns,
  mapRows,
  countyJunId,
  tilePx,
  playerRoadJunId,
  roadX,
  roadY,
  mainCityId,
  citiesInCountyRows = null,
  mainCityDbRow = null,
}) {
  if (!cells?.length) return { cx: null, cy: null, onRoadCell: false };
  const pass = buildRoadPassableKeySetForMarch(roadCells, cells, mapColumns, mapRows);
  const rx = Number(roadX);
  const ry = Number(roadY);
  /** 合并格网为郡内统一坐标；`road_jun_id` 可与当前视图 `countyJunId` 不同（邻郡城仍在同一 merged cells 内） */
  const startKey =
    Number.isFinite(rx) && Number.isFinite(ry) ? `${Math.trunc(rx)},${Math.trunc(ry)}` : null;
  const onRoadCell = !!startKey && pass.has(startKey);
  if (onRoadCell) {
    return { ...strategicRoadCellCenterPx(rx, ry, tilePx), onRoadCell: true };
  }
  if (startKey) {
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
        let cid = '';
        for (const fk of fpKeys) {
          const [gx, gy] = fk.split(',').map(Number);
          const c = cells[gy]?.[gx];
          if (c?.cityId) {
            cid = String(c.cityId);
            break;
          }
        }
        if (cid) {
          fp = collectStrategicPoiFootprint(cells, cid, mapColumns, mapRows);
        }
      }
    }
    if (fp) {
      return {
        ...strategicPoiBlockCenterPx(
          { anchorR: fp.anchorGy, anchorC: fp.anchorGx, width: fp.width, height: fp.height },
          tilePx,
        ),
        onRoadCell: false,
      };
    }
  }
  const mid = String(mainCityId || '').trim();
  if (!mid) return { cx: null, cy: null, onRoadCell: false };
  const row =
    mainCityDbRow ||
    (Array.isArray(citiesInCountyRows)
      ? citiesInCountyRows.find((r) => String(r.city_id || r.cityId || r.id) === mid)
      : null);
  if (row) {
    const fpDb = buildStrategicPoiFootprintFromDbCityRow(row, mapColumns, mapRows, cells);
    if (fpDb) {
      return {
        ...strategicPoiBlockCenterPx(
          { anchorR: fpDb.anchorGy, anchorC: fpDb.anchorGx, width: fpDb.width, height: fpDb.height },
          tilePx,
        ),
        onRoadCell: false,
      };
    }
  }
  const anchor = findStrategicCityAnchorForMainCity(cells, mid);
  if (!anchor) return { cx: null, cy: null, onRoadCell: false };
  return { ...strategicCityBlockCenterPx(anchor, tilePx), onRoadCell: false };
}

/**
 * 与 `resolveStrategicRecordedStandpointPx` 同优先级，返回合并战略格网 `(gx,gy)`，供 `scrollToStrategicCell` 居中视口。
 * @returns {{ gx: number, gy: number } | null}
 */
export function resolveStrategicRecordedStandpointCell({
  cells,
  roadCells,
  mapColumns,
  mapRows,
  countyJunId,
  playerRoadJunId,
  roadX,
  roadY,
  mainCityId,
  citiesInCountyRows = null,
  mainCityDbRow = null,
}) {
  if (!cells?.length) return null;
  const pass = buildRoadPassableKeySetForMarch(roadCells, cells, mapColumns, mapRows);
  const rx = Number(roadX);
  const ry = Number(roadY);
  const startKey =
    Number.isFinite(rx) && Number.isFinite(ry) ? `${Math.trunc(rx)},${Math.trunc(ry)}` : null;
  const onRoadCell = !!startKey && pass.has(startKey);
  if (onRoadCell) {
    return { gx: Math.trunc(rx), gy: Math.trunc(ry) };
  }
  if (startKey) {
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
        let cid = '';
        for (const fk of fpKeys) {
          const [gx, gy] = fk.split(',').map(Number);
          const c = cells[gy]?.[gx];
          if (c?.cityId) {
            cid = String(c.cityId);
            break;
          }
        }
        if (cid) {
          fp = collectStrategicPoiFootprint(cells, cid, mapColumns, mapRows);
        }
      }
    }
    if (fp) {
      return { gx: fp.anchorGx, gy: fp.anchorGy };
    }
  }
  const mid = String(mainCityId || '').trim();
  if (!mid) return null;
  const row =
    mainCityDbRow ||
    (Array.isArray(citiesInCountyRows)
      ? citiesInCountyRows.find((r) => String(r.city_id || r.cityId || r.id) === mid)
      : null);
  if (row) {
    const fpDb = buildStrategicPoiFootprintFromDbCityRow(row, mapColumns, mapRows, cells);
    if (fpDb) return { gx: fpDb.anchorGx, gy: fpDb.anchorGy };
  }
  const anchor = findStrategicCityAnchorForMainCity(cells, mid);
  if (!anchor) return null;
  return { gx: anchor.anchorC, gy: anchor.anchorR };
}
