/**
 * 战略缩略图：从合并 `cells` 收集城池 2×2 锚点（与格网 POI 一致），排除匪寨 `city_id` 族。
 *
 * **合并 JSON 惯例**：`cityId` 常仅写在 **2×2 左上锚格**；其余三格可为 `{}` 或仅有地形字段。
 * 故不能要求四格均带 `cityId`；改为锚格有城 id + 2×2 `object`，且邻格 **`readStrategicCellAnchorId`**
 * 为空或与锚格 **同一** `cityId`（不得为异城 / 匪寨 / PVP 营 id）。
 */

import { readStrategicCellAnchorId } from './strategicCellAnchorId.js';
import { strategicMapObjectIs2x2 } from './strategicRoadOverlay.js';
import { isBanditMapObjectId } from './smallMapEnemyRoster.js';

/**
 * @param {object|null|undefined} cell
 * @param {string} anchorCityId
 * @returns {boolean}
 */
function cellCompatibleWithStrategicCityFootprint(cell, anchorCityId) {
  if (!cell || typeof cell !== 'object') return false;
  const anchor = readStrategicCellAnchorId(cell);
  if (!anchor) return true;
  return anchor === anchorCityId;
}

/**
 * @param {object[][]|null|undefined} cells
 * @param {number} mapColumns
 * @param {number} mapRows
 * @returns {Array<{ cityId: string, anchorGx: number, anchorGy: number, widthCells: number, heightCells: number }>}
 */
export function collectStrategicCityFootprintsForMiniMap(cells, mapColumns, mapRows) {
  const out = [];
  if (!cells?.length) return out;
  const cols = Math.max(0, Math.trunc(Number(mapColumns)) || 0);
  const rows = Math.max(0, Math.trunc(Number(mapRows)) || 0);
  if (cols < 2 || rows < 2) return out;

  const seenCityIds = new Set();

  for (let gy = 0; gy <= rows - 2; gy++) {
    for (let gx = 0; gx <= cols - 2; gx++) {
      const c00 = cells[gy]?.[gx];
      if (!c00) continue;
      const idRaw = c00.cityId ?? c00.city_id;
      if (idRaw == null || String(idRaw).trim() === '') continue;
      const cityId = String(idRaw).trim();
      if (isBanditMapObjectId(cityId)) continue;
      if (seenCityIds.has(cityId)) continue;
      if (!strategicMapObjectIs2x2(c00.object)) continue;

      const c10 = cells[gy]?.[gx + 1];
      const c01 = cells[gy + 1]?.[gx];
      const c11 = cells[gy + 1]?.[gx + 1];
      if (!c10 || !c01 || !c11) continue;
      if (!cellCompatibleWithStrategicCityFootprint(c10, cityId)) continue;
      if (!cellCompatibleWithStrategicCityFootprint(c01, cityId)) continue;
      if (!cellCompatibleWithStrategicCityFootprint(c11, cityId)) continue;

      seenCityIds.add(cityId);
      out.push({
        cityId,
        anchorGx: gx,
        anchorGy: gy,
        widthCells: 2,
        heightCells: 2,
      });
    }
  }

  return out;
}
