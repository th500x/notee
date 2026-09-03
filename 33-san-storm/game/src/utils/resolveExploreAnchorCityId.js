import {
  buildStrategicPoiFootprintFromDbCityRow,
  findPoiFootprintKeysContainingCell,
  isAllowedPlayerCityPoiCityType,
  resolveMergedStandpointStrategicPoiAnchorId,
} from '@shared/utils/strategicMarchPoi.js';
import { readStrategicCellAnchorId } from '@shared/utils/strategicCellAnchorId.js';
import {
  isStackedWorldMap,
  playerRoadToWorldMapCell,
} from '@shared/utils/strategicGridCoordinates.js';

/**
 * 玩家 `road_*`（郡内）→ 合并 `cells` 下标用的世界格；单郡 40 行时与本地行相同。
 * @param {object|null|undefined} player
 * @param {number} mapRows
 * @returns {{ gx: number, worldGy: number }|null}
 */
function resolveWorldMapCellFromPlayerRoad(player, mapRows) {
  const j = String(player?.roadJunId ?? '').trim();
  const lx = Math.trunc(Number(player?.roadPositionX));
  const ly = Math.trunc(Number(player?.roadPositionY));
  if (!j || !Number.isFinite(lx) || !Number.isFinite(ly)) return null;
  if (isStackedWorldMap(mapRows)) {
    const w = playerRoadToWorldMapCell(j, lx, ly);
    if (!w) return null;
    return { gx: w.gx, worldGy: w.worldGy };
  }
  return { gx: lx, worldGy: ly };
}

/**
 * @param {object[][]} cells
 * @param {number} gx - 世界列
 * @param {number} worldGy - 世界行（与 `cells` 下标一致）
 */
function exploreAnchorIdFromMergedGridCells(cells, gx, worldGy, mapColumns, mapRows) {
  const wgx = Math.trunc(gx);
  const wgy = Math.trunc(worldGy);
  const direct = cells[wgy]?.[wgx];
  const directId = direct ? readStrategicCellAnchorId(direct) : '';
  if (directId) return String(directId).trim();

  const fpKeys = findPoiFootprintKeysContainingCell(cells, wgx, wgy, mapColumns, mapRows);
  if (!fpKeys?.size) return null;
  for (const fk of fpKeys) {
    const [fx, fy] = fk.split(',').map(Number);
    const c = cells[fy]?.[fx];
    const id = c ? readStrategicCellAnchorId(c) : '';
    if (id) return String(id).trim();
  }
  return null;
}

/**
 * 将玩家战略立足点（`players.road_*`，与 31-6 §7 离路锚格、`cities.position_x/y` 对齐）
 * 解析为用于探索池过滤的锚点 id（城池 `city_id` 或匪寨 `san_*_bandit_*`）。
 * 探索触发与配表 `location` 占位符的匹配见 `exploreLocationMatchesEvent` / `filterExploreEventsPool`。
 *
 * @param {object|null|undefined} player - PlayerContext（camelCase）
 * @param {Array<{ city_id?: string, cityId?: string, jun_id?: string, junId?: string, position_x?: number, position_y?: number }>|null|undefined} citiesList
 * @returns {string|null}
 */
export function resolveExploreAnchorCityIdFromPlayerRoad(player, citiesList) {
  if (!player || !Array.isArray(citiesList) || citiesList.length === 0) return null;

  const jRaw = player.roadJunId;
  const j = jRaw != null ? String(jRaw).trim() : '';
  const x = player.roadPositionX;
  const y = player.roadPositionY;
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
 * 反查当前立足点落在哪座城/匪寨 POI **占地内**，得到探索锚点 id。
 *
 * **产品规则（与事件系统一致）**：凡按城类型 / `{any_bandit}` / 具体 `city_id` 匹配的 **`location`**，
 * **仅当玩家路格落在该 POI footprint 格内**（合并格世界坐标 + `cells` 或库算 footprint）**或** 路格与库 **`position_x/y`** 一致，才算「到了该探索点」。
 * **不设**「仅在路边、与城块 8-邻的道路格」即视为该城探索锚点（否则沿路经过即误进池）。
 * **荒郊/集市**等仍由 UI **`startExplore(cityId, …)`** 显式传入锚点，不走本函数的隐式路边扩展。
 *
 * 叠放图（颍川+汝南）：`road_position_*` 为郡内行，须经 `playerRoadToWorldMapCell` 再查 `cells`，否则匪寨/城 footprint 恒对不上（教程 3/6 `{any_bandit}` 池空、不触发）。
 *
 * @param {object|null|undefined} player
 * @param {Array<object>|null|undefined} citiesList - 全量或郡内城行，用于 `countyCityRows` 缺省时的回退
 * @param {{ cells: object[][], mapColumns: number, mapRows: number, countyCityRows?: object[]|null, roadCells?: Array<{gx:number,gy:number}>|string[]|null }} gridCtx
 * @returns {string|null}
 */
export function resolveExploreAnchorCityIdFromStrategicGrid(player, citiesList, gridCtx) {
  if (!player || !Array.isArray(citiesList) || citiesList.length === 0) return null;

  if (gridCtx?.cells?.length) {
    const mc = Number(gridCtx.mapColumns);
    const mr = Number(gridCtx.mapRows);
    if (Number.isFinite(mc) && Number.isFinite(mr) && mc > 0 && mr > 0) {
      const world = resolveWorldMapCellFromPlayerRoad(player, mr);
      if (world) {
        const rows =
          Array.isArray(gridCtx.countyCityRows) && gridCtx.countyCityRows.length > 0
            ? gridCtx.countyCityRows
            : citiesList;
        const roadCells = gridCtx.roadCells ?? null;

        /** 与 pawn / 城面板同源：`roadCells` 可通行格落在城 2×2 footprint 内仍算该城（典型：颍川阳翟） */
        const poiAnchorId = resolveMergedStandpointStrategicPoiAnchorId(
          gridCtx.cells,
          roadCells,
          mc,
          mr,
          world.gx,
          world.worldGy,
          rows,
          null,
        );
        if (poiAnchorId) return poiAnchorId;

        const fromCells = exploreAnchorIdFromMergedGridCells(
          gridCtx.cells,
          world.gx,
          world.worldGy,
          mc,
          mr,
        );
        if (fromCells) return fromCells;

        const k0 = `${world.gx},${world.worldGy}`;
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
  }

  return resolveExploreAnchorCityIdFromPlayerRoad(player, citiesList);
}
