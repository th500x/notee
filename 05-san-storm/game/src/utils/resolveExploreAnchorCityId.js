import {
  buildStrategicPoiFootprintFromDbCityRow,
  findPoiFootprintKeysContainingCell,
  isAllowedPlayerCityPoiCityType,
} from '@shared/utils/strategicMarchPoi.js';

/**
 * 与 `resolveStrategicRecordedStandpointPx` 一致：库坐标 footprint 与合并格不一致时，
 * 仍可从 `cells` 反查 `(gx,gy)` 落在哪座 POI 占地内。
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
 * 在「路点坐标 = 库内城心锚格」匹配失败时，用战略合并格 `cells` + 库 footprint（与 `resolveStrategicRecordedStandpointPx` 离路立点一致，**均无主城回退**）
 * 反查当前 `(road_x, road_y)` 落在哪座城的 POI **占地内**，得到 `city_id`。
 *
 * **产品规则（与事件系统一致）**：凡按城类型 / 具体城 `city_id` 匹配的 **`location`**（`{city_small}`、`{city_medium}`、`{city_major}` 等），
 * **仅当玩家路格落在该城 POI footprint 格内**（合并格 `cells` 或库算 footprint）**或** 路格与库 **`position_x/y`** 一致，才算「到了这座城」。
 * **不设**「仅在路边、与城块 8-邻的道路格」即视为该城探索锚点（否则沿路经过即误进池）。
 * **荒郊/集市**等仍由 UI **`startExplore(cityId, …)`** 显式传入锚点，不走本函数的隐式路边扩展。
 *
 * 典型场景：行军停在城内**道路格**，`road_position` 在城块 footprint 内但≠ `cities.position_x/y`（库只记锚格），
 * 须用格网 + **`buildStrategicPoiFootprintFromDbCityRow`** 命中 footprint。
 *
 * 另一典型场景：`road_position` 恰与库内**关隘/据点**等行的 `position_x/y` 重合时，`resolveExploreAnchorCityIdFromPlayerRoad`
 * 会先命中该行；故须**优先**按合并格 `cells` 反查 POI（与 `resolveStrategicRecordedStandpointPx` 离路解析一致），再库 footprint，最后才路点锚格匹配。
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
        const ct = row.city_type ?? row.cityType;
        if (!isAllowedPlayerCityPoiCityType(ct)) continue;
        const fp = buildStrategicPoiFootprintFromDbCityRow(row, mc, mr, gridCtx.cells);
        if (fp?.keys?.has(k0)) {
          const id = row.city_id ?? row.cityId;
          if (id != null && String(id).trim() !== '') return String(id).trim();
        }
      }
    }
  }

  return resolveExploreAnchorCityIdFromPlayerRoad(player, citiesList);
}
