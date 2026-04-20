/**
 * 战略道路行军：客户端最短路径与粮草预览（与 `roadEncounterService` 常量对齐，供 UI 确认前展示）。
 */

import { strategicMapObjectIs2x2 } from '@/utils/campaignMapVisualAssets';
import {
  buildRoadPassableKeySetForMarch,
  buildMarchPathToStrategicPoi as buildMarchPathToStrategicPoiShared,
  resolveOffRoadMarchDepartureFootprintKeys,
} from '@shared/utils/strategicMarchPoi.js';

/** 与 backend/services/roadEncounterService.js 一致 */
export const MARCH_FREE_MOVES_PER_DAY = 50;
export const MARCH_FOOD_PER_STEP = 10;
export const MARCH_RESERVE_FOOD_DAILY_LIMIT = 500;

const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
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

function bfsShortestPath(roadPassable, startKey, endKey, mapColumns, mapRows) {
  if (!roadPassable.has(startKey) || !roadPassable.has(endKey)) return null;
  const queue = [startKey];
  const came = new Map([[startKey, null]]);
  while (queue.length) {
    const k = queue.shift();
    if (k === endKey) break;
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= mapColumns || ny >= mapRows) continue;
      const nk = `${nx},${ny}`;
      if (!roadPassable.has(nk) || came.has(nk)) continue;
      came.set(nk, k);
      queue.push(nk);
    }
  }
  if (!came.has(endKey)) return null;
  const keys = [];
  let cur = endKey;
  while (cur != null) {
    keys.push(cur);
    cur = came.get(cur);
  }
  keys.reverse();
  return keys.map((key) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  });
}

function multiSourceBfsShortest(roadPassable, startKeys, endKey, mapColumns, mapRows) {
  if (!roadPassable.has(endKey)) return null;
  const queue = [];
  const came = new Map();
  for (const sk of startKeys) {
    if (!roadPassable.has(sk)) continue;
    came.set(sk, null);
    queue.push(sk);
  }
  if (!queue.length) return null;
  while (queue.length) {
    const k = queue.shift();
    if (k === endKey) break;
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= mapColumns || ny >= mapRows) continue;
      const nk = `${nx},${ny}`;
      if (!roadPassable.has(nk) || came.has(nk)) continue;
      came.set(nk, k);
      queue.push(nk);
    }
  }
  if (!came.has(endKey)) return null;
  const keys = [];
  let cur = endKey;
  while (cur != null) {
    keys.push(cur);
    cur = came.get(cur);
  }
  keys.reverse();
  return keys.map((key) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  });
}

function roadKeysAdjacentToFootprint(footprintKeys, roadPassable) {
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
 * @param {object} p
 * @param {object[][]} p.cells
 * @param {unknown} p.roadCells
 * @param {number} p.mapColumns
 * @param {number} p.mapRows
 * @param {string} p.countyJunId
 * @param {object} p.player - profile.player
 * @param {number} p.targetGx
 * @param {number} p.targetGy
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
  mainCityDbRow = null,
  citiesInCountyRows = null,
}) {
  if (!cells?.length || !roadCells?.length) {
    return { ok: false, error: '当前地图缺少道路数据' };
  }
  const roadPassable = buildRoadPassableKeySet(roadCells, cells, mapColumns, mapRows);
  const tx = Math.trunc(Number(targetGx));
  const ty = Math.trunc(Number(targetGy));
  const targetKey = `${tx},${ty}`;
  if (!roadPassable.has(targetKey)) {
    return { ok: false, error: '请选择道路格作为目标' };
  }

  const roadJun = player?.road_jun_id || null;
  const rx = Number(player?.road_position_x);
  const ry = Number(player?.road_position_y);
  const startKeyIf =
    roadJun === countyJunId && Number.isFinite(rx) && Number.isFinite(ry) ? `${Math.trunc(rx)},${Math.trunc(ry)}` : null;
  const onRoad = !!startKeyIf && roadPassable.has(startKeyIf);

  if (onRoad) {
    const startKey = startKeyIf;
    if (startKey === targetKey) {
      return { ok: true, path: [{ x: Math.trunc(rx), y: Math.trunc(ry) }], onRoadAtStart: true };
    }
    const path = bfsShortestPath(roadPassable, startKey, targetKey, mapColumns, mapRows);
    if (!path) return { ok: false, error: '无法沿道路到达该格' };
    return { ok: true, path, onRoadAtStart: true };
  }

  const footprint = resolveOffRoadMarchDepartureFootprintKeys(
    cells,
    player,
    countyJunId,
    mapColumns,
    mapRows,
    collectMainCityFootprintKeys,
    { mainCityDbRow, citiesInCountyRows },
  );
  if (!footprint.size) {
    return { ok: false, error: '未设置主城或不在可识别的城/寨占格上，无法沿路出发' };
  }
  const starts = roadKeysAdjacentToFootprint(footprint, roadPassable);
  if (!starts.size) return { ok: false, error: '出发地旁没有可通行的道路格' };
  const path = multiSourceBfsShortest(roadPassable, starts, targetKey, mapColumns, mapRows);
  if (!path) return { ok: false, error: '无法沿道路到达该格' };
  return { ok: true, path, onRoadAtStart: false };
}

/**
 * 行军终点为 **本势力城心** 或 **匪寨**（31-6 §9.4）；道路段子路径 + `poiAnchor`。
 * @param {object} p
 * @param {string} p.targetCityId
 */
export function buildMarchPathToPoi(p) {
  return buildMarchPathToStrategicPoiShared({
    ...p,
    collectMainCityFootprintKeys: (cells, mainId) => collectMainCityFootprintKeys(cells, mainId),
    targetCityDbRow: p.targetCityDbRow ?? null,
    mainCityDbRow: p.mainCityDbRow ?? null,
    citiesInCountyRows: p.citiesInCountyRows ?? null,
  });
}

/**
 * 与 `moveAlongRoad` 中「先扣免费格再每格 10 粮」一致（不模拟遭遇截断）。
 * @param {object} p
 * @param {{x:number,y:number}[]} p.path
 * @param {boolean} p.onRoadAtStart
 * @param {object} p.player
 */
export function estimateMarchFoodCost({ path, onRoadAtStart, player }) {
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
    };
  }

  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const fd = player?.road_move_free_date;
  const freeDateStr = fd ? new Date(fd).toISOString().slice(0, 10) : null;
  const freeUsedBase = freeDateStr === todayStr ? Number(player?.road_move_free_used) || 0 : 0;

  const rd = player?.road_reserve_date;
  const reserveDateStr = rd ? new Date(rd).toISOString().slice(0, 10) : null;
  const reserveUsedBase = reserveDateStr === todayStr ? Number(player?.road_reserve_used) || 0 : 0;

  let freeRem = Math.max(0, MARCH_FREE_MOVES_PER_DAY - freeUsedBase);
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
  };
}
