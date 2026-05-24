/**
 * 战事发动「地图距离」规则：与战略缩略图 `computeStrategicMiniMapProximityHighlights` 同源
 *（己方城 footprint 中心曼哈顿距 → 全图取最近 3 敌对城 + 最近 3 中立城）。
 *
 * 数据源：`cities.position_x/y` 为 **郡内** 锚格（与 `worldMapAdminService` 写入一致）；
 * 豫州多郡垂直叠放时须用 `strategicGridCoordinates.worldMapCellFromCityDbRow` 转成 **合并画布世界行**，
 * 与 `collectStrategicCityFootprintsForMiniMap(merged.cells)` 一致。列 `gx` 与单郡宽一致，仍为 `position_x`。
 */

const { pool } = require('../database/connection');
const {
  computeStrategicMiniMapProximityHighlights,
} = require('../../shared/utils/computeStrategicMiniMapProximityHighlights.js');
const { worldMapCellFromCityDbRow } = require('../../shared/utils/strategicGridCoordinates.js');

/**
 * @param {string} season
 * @returns {Promise<{ footprints: Array<object>, cityById: Record<string, object> }>}
 */
async function loadFootprintsAndCityByIdForSeason(season) {
  const s = String(season || 'san_1').trim() || 'san_1';
  const [rows] = await pool.query(
    `SELECT city_id, city_name, city_type, faction_id, jun_id, position_x, position_y
     FROM cities
     WHERE COALESCE(NULLIF(TRIM(season), ''), 'san_1') = ?
       AND position_x IS NOT NULL
       AND position_y IS NOT NULL`,
    [s],
  );
  const footprints = [];
  const cityById = {};
  for (const r of rows) {
    const id = String(r.city_id || '').trim();
    if (!id) continue;
    const localGx = Math.trunc(Number(r.position_x));
    const localGy = Math.trunc(Number(r.position_y));
    if (!Number.isFinite(localGx) || !Number.isFinite(localGy)) continue;
    const junId = String(r.jun_id || '').trim();
    const w = worldMapCellFromCityDbRow(r);
    const anchorGx = w?.gx ?? localGx;
    const anchorGy = w?.worldGy ?? localGy;
    footprints.push({
      cityId: id,
      anchorGx,
      anchorGy,
      widthCells: 2,
      heightCells: 2,
    });
    cityById[id] = {
      faction_id: r.faction_id,
      factionId: r.faction_id,
      city_type: r.city_type,
      cityType: r.city_type,
    };
  }
  return { footprints, cityById };
}

/**
 * @param {string} factionId
 * @param {string} [season]
 * @param {Set<string>|string[]|null} [allyFactionIds]
 * @param {Set<string>|string[]|null} [nonHostileFactionIds]
 * @returns {Promise<{ hostileCityIds: string[], neutralCityIds: string[] }>}
 */
async function getProximityHighlightCityIds(
  factionId,
  season = 'san_1',
  allyFactionIds = null,
  nonHostileFactionIds = null,
) {
  const fid = String(factionId || '').trim();
  if (!fid) return { hostileCityIds: [], neutralCityIds: [] };
  const { footprints, cityById } = await loadFootprintsAndCityByIdForSeason(season);
  return computeStrategicMiniMapProximityHighlights(
    footprints,
    cityById,
    fid,
    allyFactionIds,
    nonHostileFactionIds,
  );
}

async function assertHostilePvpTargetInMapRange(factionId, targetCityId, season) {
  const { hostileCityIds } = await getProximityHighlightCityIds(factionId, season);
  const tid = String(targetCityId || '').trim();
  if (!tid || !new Set(hostileCityIds).has(tid)) {
    throw new Error('地图距离过远');
  }
}

async function assertNeutralPveTargetInMapRange(factionId, targetCityId, season) {
  const { neutralCityIds } = await getProximityHighlightCityIds(factionId, season);
  const tid = String(targetCityId || '').trim();
  if (!tid || !new Set(neutralCityIds).has(tid)) {
    throw new Error('地图距离过远');
  }
}

module.exports = {
  getProximityHighlightCityIds,
  assertHostilePvpTargetInMapRange,
  assertNeutralPveTargetInMapRange,
  loadFootprintsAndCityByIdForSeason,
};
