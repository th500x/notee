/**
 * 战略道路行军：客户端最短路径与粮草预览（与 `backend/config/roadConfig.js` 常量对齐，供 UI 确认前展示）。
 */

import { strategicMapObjectIs2x2 } from '@/utils/mapTileVisualAssets';
import {
  buildRoadPassableKeySetForMarch,
  buildMarchPathToStrategicPoi as buildMarchPathToStrategicPoiShared,
  resolveOffRoadMarchDepartureFootprintKeys,
  roadKeysAdjacentToFootprint,
  bfsShortestPathRoad,
  multiSourceBfsShortestRoad,
  playerRoadStandFromProfile,
} from '@shared/utils/strategicMarchPoi.js';
import { playerRoadToWorldMapCell } from '@shared/utils/strategicGridCoordinates.js';

/** 与 backend/config/roadConfig.js 一致 */
/** 须与 `backend/config/roadConfig.js` · `FREE_MOVES_PER_DAY` 一致 */
export const MARCH_FREE_MOVES_PER_DAY = 300;
export const MARCH_FOOD_PER_STEP = 2;
export const MARCH_RESERVE_FOOD_DAILY_LIMIT = 500;

/**
 * 按格网 `cityId` 收集某城 footprint（工具函数）。**战略离路行军出发**已不使用 `main_city_id` 回退，勿再接入 `resolveOffRoadMarchDepartureFootprintKeys`。
 * @param {object[][]|null|undefined} cells
 * @param {string|null|undefined} mainCityId
 * @returns {Set<string>} `"gx,gy"`
 */
export function collectMainCityFootprintKeys(cells, mainCityId) {
  const S = new Set();
  const id = String(mainCityId || '').trim();
  if (!id || !cells?.length) return S;

  const mapRows = cells.length;
  for (let ri = 0; ri < mapRows; ri++) {
    const row = cells[ri];
    if (!row) continue;
    const mapColumns = row.length;
    for (let ci = 0; ci < mapColumns; ci++) {
      const cell = row[ci];
      if (!cell?.cityId || String(cell.cityId) !== id) continue;
      if (strategicMapObjectIs2x2(cell?.object)) {
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const gx = ci + dx;
            const gy = ri + dy;
            if (gx >= 0 && gy >= 0 && gx < mapColumns && gy < mapRows) S.add(`${gx},${gy}`);
          }
        }
        return S;
      }
    }
  }

  for (let ri = 0; ri < cells.length; ri++) {
    const row = cells[ri];
    if (!row) continue;
    for (let ci = 0; ci < row.length; ci++) {
      const cell = row[ci];
      if (cell?.cityId && String(cell.cityId) === id) {
        S.add(`${ci},${ri}`);
        return S;
      }
    }
  }
  return S;
}

/** 可落脚道路格（含匪寨 1×2/2×1 占格从道路集合剔除，与后端 `loadRoadGrid` 一致） */
export const buildRoadPassableKeySet = buildRoadPassableKeySetForMarch;

/**
 * @param {object} p
 * @param {object[][]} p.cells
 * @param {unknown} p.roadCells
 * @param {number} p.mapColumns
 * @param {number} p.mapRows
 * @param {string} p.countyJunId
 * @param {object} p.player - profile.player
 * @param {number} p.targetGx
 * @param {number} p.targetGy
 * @param {Set<string>|null|undefined} [p.hostileOccupiedRoadKeys] 已废弃，不参与寻路（保留入参兼容旧调用）。
 * @param {boolean} [p.useWorldStackRoadCoords] 叠放大地图时 `targetGy` / 起点为 **世界行**。
 * @param {Array<{ junId?: string, cells?: string[], pvpWarId?: string }>|null|undefined} [p.pvpBaseCamps] 离路出发 footprint（大本营等）
 * @returns {{ ok: true, path: {x:number,y:number}[], onRoadAtStart: boolean } | { ok: false, error: string }}
 */
export function buildMarchPath({
  cells,
  roadCells,
  mapColumns,
  mapRows,
  countyJunId,
  player,
  targetGx,
  targetGy,
  citiesInCountyRows = null,
  hostileOccupiedRoadKeys = null,
  useWorldStackRoadCoords = false,
  pvpBaseCamps = null,
}) {
  if (!cells?.length || !roadCells?.length) {
    return { ok: false, error: '当前地图缺少道路数据' };
  }
  const roadPassable = buildRoadPassableKeySet(roadCells, cells, mapColumns, mapRows);
  /* 最短路按全道路网；敌对占格在提交移动时由服务端处理遭遇，不作为寻路障碍。 */
  void hostileOccupiedRoadKeys;

  const tx = Math.trunc(Number(targetGx));
  const ty = Math.trunc(Number(targetGy));
  const targetKey = `${tx},${ty}`;
  if (!roadPassable.has(targetKey)) {
    return { ok: false, error: '请选择道路格作为目标' };
  }

  const { roadJunId: roadJun, roadPositionX: rx, roadPositionY: ry } = playerRoadStandFromProfile(player);
  const startWorld =
    useWorldStackRoadCoords && roadJun && Number.isFinite(rx) && Number.isFinite(ry)
      ? playerRoadToWorldMapCell(roadJun, Math.trunc(rx), Math.trunc(ry))
      : null;
  const startWy = startWorld ? startWorld.worldGy : Math.trunc(ry);
  const canUseStartKey =
    Number.isFinite(rx) &&
    Number.isFinite(ry) &&
    !!String(roadJun || '').trim() &&
    (useWorldStackRoadCoords ? true : String(roadJun).trim() === String(countyJunId || '').trim());
  const startKeyIf = canUseStartKey ? `${Math.trunc(rx)},${startWy}` : null;
  const onRoad = !!startKeyIf && roadPassable.has(startKeyIf);

  if (onRoad) {
    const startKey = startKeyIf;
    if (startKey === targetKey) {
      return { ok: true, path: [{ x: Math.trunc(rx), y: Math.trunc(ry) }], onRoadAtStart: true };
    }
    const path = bfsShortestPathRoad(roadPassable, startKey, targetKey, mapColumns, mapRows);
    if (!path) return { ok: false, error: '无法沿道路到达该格' };
    return { ok: true, path, onRoadAtStart: true };
  }

  const footprint = resolveOffRoadMarchDepartureFootprintKeys(
    cells,
    player,
    countyJunId,
    mapColumns,
    mapRows,
    { citiesInCountyRows, pvpBaseCamps },
    useWorldStackRoadCoords,
  );
  if (!footprint.size) {
    return {
      ok: false,
      error:
        '离路起点无法解析：当前坐标须落在库城/格网城寨/PVP 攻方大本营等已登记 POI 占格内（不以主城替代）。请刷新地图或核对 road_position。',
    };
  }
  const starts = roadKeysAdjacentToFootprint(footprint, roadPassable);
  if (!starts.size) return { ok: false, error: '出发地旁没有可通行的道路格' };
  const path = multiSourceBfsShortestRoad(roadPassable, starts, targetKey, mapColumns, mapRows);
  if (!path) return { ok: false, error: '无法沿道路到达该格' };
  return { ok: true, path, onRoadAtStart: false };
}

/**
 * 行军终点为 **本势力城心** 或 **匪寨**（31-6 §7）；道路段子路径 + `poiAnchor`。
 * @param {object} p
 * @param {string} p.targetPoiId
 */
export function buildMarchPathToPoi(p) {
  return buildMarchPathToStrategicPoiShared({
    ...p,
    targetCityDbRow: p.targetCityDbRow ?? null,
    citiesInCountyRows: p.citiesInCountyRows ?? null,
    hostileOccupiedRoadKeys: p.hostileOccupiedRoadKeys ?? null,
    useWorldStackRoadCoords: p.useWorldStackRoadCoords ?? false,
    pvpCampBaseCamp: p.pvpCampBaseCamp ?? null,
    pvpBaseCamps: p.pvpBaseCamps ?? null,
  });
}

/**
 * 与 `moveAlongRoad` 中「先扣免费格再每格付费粮（`MARCH_FOOD_PER_STEP`）」一致（不模拟遭遇截断）。
 * @param {object} p
 * @param {{x:number,y:number}[]} p.path
 * @param {boolean} p.onRoadAtStart
 * @param {object} p.player
 */
export function estimateMarchFoodCost({ path, onRoadAtStart, player }) {
  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const fd = player?.roadMoveFreeDate;
  const freeDateStr = fd ? new Date(fd).toISOString().slice(0, 10) : null;
  const freeUsedBase = freeDateStr === todayStr ? Number(player?.roadMoveFreeUsed) || 0 : 0;

  const rd = player?.roadReserveDate;
  const reserveDateStr = rd ? new Date(rd).toISOString().slice(0, 10) : null;
  const reserveUsedBase = reserveDateStr === todayStr ? Number(player?.roadReserveUsed) || 0 : 0;

  const freeQuotaBeforeMarch = Math.max(0, MARCH_FREE_MOVES_PER_DAY - freeUsedBase);

  const stepsLen = onRoadAtStart ? Math.max(0, path.length - 1) : path.length;
  if (stepsLen <= 0) {
    return {
      steps: 0,
      freeSteps: 0,
      paidSteps: 0,
      foodFromPlayer: 0,
      reserveFromFaction: 0,
      totalFoodCost: 0,
      reserveRemaining: MARCH_RESERVE_FOOD_DAILY_LIMIT,
      reserveExceeded: false,
      freeQuotaPerDay: MARCH_FREE_MOVES_PER_DAY,
      freeQuotaRemainingBeforeMarch: freeQuotaBeforeMarch,
      freeQuotaRemainingAfterMarch: freeQuotaBeforeMarch,
    };
  }

  let freeRem = freeQuotaBeforeMarch;
  let usedFree = 0;
  let paid = 0;
  for (let i = 0; i < stepsLen; i++) {
    if (freeRem > 0) {
      freeRem--;
      usedFree++;
    } else {
      paid++;
    }
  }
  const totalFood = paid * MARCH_FOOD_PER_STEP;
  const foodPlayer = Number(player?.food) || 0;
  const fromPlayer = Math.min(totalFood, foodPlayer);
  const fromReserve = totalFood - fromPlayer;
  const reserveRem = Math.max(0, MARCH_RESERVE_FOOD_DAILY_LIMIT - reserveUsedBase);

  return {
    steps: stepsLen,
    freeSteps: usedFree,
    paidSteps: paid,
    foodFromPlayer: fromPlayer,
    reserveFromFaction: fromReserve,
    totalFoodCost: totalFood,
    reserveRemaining: reserveRem,
    reserveExceeded: fromReserve > reserveRem,
    freeQuotaPerDay: MARCH_FREE_MOVES_PER_DAY,
    freeQuotaRemainingBeforeMarch: freeQuotaBeforeMarch,
    freeQuotaRemainingAfterMarch: freeRem,
  };
}
