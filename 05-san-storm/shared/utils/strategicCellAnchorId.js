/**
 * 战略合并格锚点标识读取：城池仍用 `cityId` / `city_id`；匪寨专用 **`banditPoiId`** / `bandit_poi_id`
 *（与 04-1 §15.4 `targetPoiId` / HTTP `banditPoiId` 同族，勿与城池主键语义混称）。
 */

/**
 * @param {object|null|undefined} cell - `merged.cells[gy][gx]`
 * @returns {string} 非空锚点 id；无则 `''`
 */
export function readStrategicCellAnchorId(cell) {
  if (!cell || typeof cell !== 'object') return '';
  const b = cell.banditPoiId ?? cell.bandit_poi_id;
  if (b != null && String(b).trim() !== '') return String(b).trim();
  const c = cell.cityId ?? cell.city_id;
  if (c != null && String(c).trim() !== '') return String(c).trim();
  return '';
}
