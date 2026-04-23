import {
  buildStrategicPoiFootprintFromDbCityRow,
  findPoiFootprintKeysContainingCell,
  isAllowedPlayerCityPoiCityType,
} from '@shared/utils/strategicMarchPoi.js';

/**
 * 与 `resolveStrategicRecordedStandpointPx` 一致：库坐标 footprint 与合并格不一致时，
 * 仍可从 `cells` 反查 `(gx,gy)` 落在哪座 POI 的占地内。
 * @returns {string|null}
 */
function exploreAnchorCityIdFromMergedGridCells(cells, gx, gy, mapColumns, mapRows) {
  const fpKeys = findPoiFootprintKeysContainingCell(cells, gx, gy, mapColumns, mapRows);
  if (!fpKeys?.size) return null;
  for (const fk of fpKeys) {
    const [fx, fy] = fk.split(',').map(Number);
    const c = cells[fy]?.[fx];
    const id = c?.cityId != null ? String(c.cityId).trim() : '';
    if (id) return id;
  }
  return null;
}
/**
 * 将玩家战略立足点（`players.road_*`，与 31-6 §9.4 离路锚格、`cities.position_x/y` 对齐）
 * 解析为用于探索池过滤的 `city_id`。
 * 探索触发与配表 `location` 占位符的匹配见 `exploreLocationMatchesEvent` / `filterExploreEventsPool`。
 *
 * @param {object|null|undefined} player - PlayerContext（camelCase）
 * @param {Array<{ city_id?: string, cityId?: string, jun_id?: string, junId?: string, position_x?: number, position_y?: number }>|null|undefined} citiesList
 * @returns {string|null}
 */
export function resolveExploreAnchorCityIdFromPlayerRoad(player, citiesList) {
  if (!player || !Array.isArray(citiesList) || citiesList.length === 0) return null;

  const jRaw = player.road_jun_id ?? player.roadJunId;
  const j = jRaw != null ? String(jRaw).trim() : '';
  const x = player.road_position_x ?? player.roadPositionX;
  const y = player.road_position_y ?? player.roadPositionY;
  if (!j || x == null || y == null) return null;

  const nx = Number(x);
  const ny = Number(y);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;

  const matchRow = (c) => {
    const cj = String(c.jun_id ?? c.junId ?? '').trim();
    const px = Number(c.position_x ?? c.positionX);
    const py = Number(c.position_y ?? c.positionY);
    return cj === j && px === nx && py === ny;
  };

  let row = citiesList.find(matchRow);
  if (!row) {
    row = citiesList.find((c) => {
      const px = Number(c.position_x ?? c.positionX);
      const py = Number(c.position_y ?? c.positionY);
      return px === nx && py === ny;
    });
  }

  const id = row?.city_id ?? row?.cityId;
  return id != null && String(id).trim() !== '' ? String(id).trim() : null;
}

/**
 * 在「路点坐标 = 库内城心锚格」匹配失败时，用战略合并格 `cells` + 库 footprint（与 `resolveStrategicRecordedStandpointPx` 离路立点一致）
 * 反查当前 `(road_x, road_y)` 落在哪座城的 POI 占地内，得到 `city_id`。
 *
 * 典型场景：行军停在本城**道路格**，`road_position` 在城块 2×2 footprint 内但≠ `cities.position_x/y`（仅记锚格），
 * 若仍用旧逻辑会得到 `null`，`exploreLocationId` 不更新，`{city_medium}` 等按城类型过滤的链事件（如教程 1002）永远进不了池。
 *
 * 另一典型场景：`road_position` 恰与库内**关隘/据点**等行的 `position_x/y` 重合时，`resolveExploreAnchorCityIdFromPlayerRoad`
 * 会先命中该行并提前返回，导致合并格上实际所处的中/小城 `city_id` 永远进不了探索锚点；须**优先**按合并格 `cells`
 * 反查 POI（与 `resolveStrategicRecordedStandpointPx` 的离路回退一致），再库 footprint，最后才用路点锚格匹配。
 *
 * **邻接道路格**：行军终点常在城块 2×2 **外侧**的合法道路格（或未带 `targetPoiId` 时仅走到邻格），坐标不在 footprint 内。
 * 此时仍应把探索锚点视为该城，否则 `exploreLocationId` 为空、`{city_medium}` 链事件（如教程 1002）池恒为空。
 *
 * @param {object|null|undefined} player
 * @param {Array<object>|null|undefined} citiesList - 全量或郡内城行，用于 `countyCityRows` 缺省时的回退
 * @param {{ cells: object[][], mapColumns: number, mapRows: number, countyCityRows?: object[]|null }} gridCtx
 * @returns {string|null}
 */
export function resolveExploreAnchorCityIdFromStrategicGrid(player, citiesList, gridCtx) {
  if (!player || !Array.isArray(citiesList) || citiesList.length === 0) return null;

  const x = player.road_position_x ?? player.roadPositionX;
  const y = player.road_position_y ?? player.roadPositionY;
  if (x == null || y == null) return null;
  const gx = Math.trunc(Number(x));
  const gy = Math.trunc(Number(y));
  if (!Number.isFinite(gx) || !Number.isFinite(gy)) return null;

  if (gridCtx?.cells?.length) {
    const mc = Number(gridCtx.mapColumns);
    const mr = Number(gridCtx.mapRows);
    if (Number.isFinite(mc) && Number.isFinite(mr) && mc > 0 && mr > 0) {
      const fromCells = exploreAnchorCityIdFromMergedGridCells(gridCtx.cells, gx, gy, mc, mr);
      if (fromCells) return fromCells;

      const rows =
        Array.isArray(gridCtx.countyCityRows) && gridCtx.countyCityRows.length > 0
          ? gridCtx.countyCityRows
          : citiesList;
      const k0 = `${gx},${gy}`;
      for (const row of rows) {
        const fp = buildStrategicPoiFootprintFromDbCityRow(row, mc, mr, gridCtx.cells);
        if (fp?.keys?.has(k0)) {
          const id = row.city_id ?? row.cityId;
          if (id != null && String(id).trim() !== '') return String(id).trim();
        }
      }

      /** 大/中/小城 POI：当前格在占地外但与 footprint 8-邻（含对角）相接 → 视为「在该城探索」 */
      let bestAdjId = null;
      let bestAdjDist = Infinity;
      for (const row of rows) {
        const ct = row.city_type ?? row.cityType;
        if (!isAllowedPlayerCityPoiCityType(ct)) continue;
        const fp = buildStrategicPoiFootprintFromDbCityRow(row, mc, mr, gridCtx.cells);
        if (!fp?.keys?.size || fp.keys.has(k0)) continue;
        let touches = false;
        for (const fk of fp.keys) {
          const [fx, fy] = fk.split(',').map(Number);
          const dx = Math.abs(fx - gx);
          const dy = Math.abs(fy - gy);
          if (dx <= 1 && dy <= 1 && (dx > 0 || dy > 0)) {
            touches = true;
            break;
          }
        }
        if (!touches) continue;
        const id = row.city_id ?? row.cityId;
        if (id == null || String(id).trim() === '') continue;
        const sid = String(id).trim();
        const d =
          Math.abs(fp.anchorGx - gx) + Math.abs(fp.anchorGy - gy);
        if (d < bestAdjDist || (d === bestAdjDist && sid < String(bestAdjId || ''))) {
          bestAdjDist = d;
          bestAdjId = sid;
        }
      }
      if (bestAdjId) return bestAdjId;
    }
  }

  return resolveExploreAnchorCityIdFromPlayerRoad(player, citiesList);
}
