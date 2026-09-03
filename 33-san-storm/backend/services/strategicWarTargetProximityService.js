/**
 * 战事发动「地图距离」规则：与战略缩略图 `computeStrategicMiniMapProximityHighlights` 同源
 *（己方城 footprint 中心曼哈顿距 → 全图取最近 3 敌对城 + 最近 3 中立城；含大/中城郡内清剿门闸）。
 *
 * 数据源：`cities.position_x/y` 为 **郡内** 锚格（与工坊 / `junStrategicWorkshopService` 写入一致）；
 * 豫州多郡垂直叠放时须用 `strategicGridCoordinates.worldMapCellFromCityDbRow` 转成 **合并画布世界行**，
 * 与 `collectStrategicCityFootprintsForMiniMap(merged.cells)` 一致。列 `gx` 与单郡宽一致，仍为 `position_x`。
 */

const { pool } = require('../database/connection');
const { loadRoadGridSan1YuVerticalStack } = require('../utils/roadGrid');
const {
  computeStrategicMiniMapProximityHighlights,
} = require('../../shared/utils/computeStrategicMiniMapProximityHighlights.js');
const { evaluateWarJunClearance } = require('../../shared/utils/warJunClearanceGate.cjs');
const { worldMapCellFromCityDbRow } = require('../../shared/utils/strategicGridCoordinates.js');

/**
 * 与前端 `collectStrategicCityFootprintsForMiniMap(merged.cells)` 同源（合并豫州栈 JSON）。
 * @param {string} season
 * @returns {Promise<Array<object>|null>}
 */
async function loadFootprintsFromMergedStack(season) {
  const s = String(season || 'san_1').trim() || 'san_1';
  if (s !== 'san_1') return null;
  try {
    const stack = await loadRoadGridSan1YuVerticalStack(s);
    if (!stack?.rawCells?.length) return null;
    const { collectStrategicCityFootprintsForMiniMap } = await import(
      '../../shared/utils/strategicMiniMapGeometry.js'
    );
    return collectStrategicCityFootprintsForMiniMap(
      stack.rawCells,
      stack.mapColumns,
      stack.mapRows,
    );
  } catch (e) {
    console.warn('[strategicWarTargetProximity] merged stack footprints:', e.message);
    return null;
  }
}

function buildDbFootprint(r) {
  const localGx = Math.trunc(Number(r.position_x));
  const localGy = Math.trunc(Number(r.position_y));
  if (!Number.isFinite(localGx) || !Number.isFinite(localGy)) return null;
  const w = worldMapCellFromCityDbRow(r);
  return {
    cityId: String(r.city_id || '').trim(),
    anchorGx: w?.gx ?? localGx,
    anchorGy: w?.worldGy ?? localGy,
    widthCells: 2,
    heightCells: 2,
  };
}

/**
 * @param {string} season
 * @returns {Promise<{ footprints: Array<object>, cityById: Record<string, object> }>}
 */
async function loadFootprintsAndCityByIdForSeason(season) {
  const s = String(season || 'san_1').trim() || 'san_1';
  // 清剿门闸需要同郡全部城（含无坐标）；缩略距离仅用有坐标者建 footprint
  const [rows] = await pool.query(
    `SELECT city_id, city_name, city_type, faction_id, jun_id, position_x, position_y
     FROM cities
     WHERE COALESCE(NULLIF(TRIM(season), ''), 'san_1') = ?`,
    [s],
  );
  const cityById = {};
  for (const r of rows) {
    const id = String(r.city_id || '').trim();
    if (!id) continue;
    cityById[id] = {
      faction_id: r.faction_id,
      factionId: r.faction_id,
      city_type: r.city_type,
      cityType: r.city_type,
      jun_id: r.jun_id,
      junId: r.jun_id,
    };
  }

  const mergedFootprints = await loadFootprintsFromMergedStack(s);
  let footprints = [];
  if (mergedFootprints?.length) {
    footprints = mergedFootprints.filter((fp) => cityById[String(fp.cityId || '').trim()]);
  }
  if (!footprints.length) {
    for (const r of rows) {
      if (r.position_x == null || r.position_y == null) continue;
      const fp = buildDbFootprint(r);
      if (fp?.cityId) footprints.push(fp);
    }
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

/**
 * 大/中城郡内清剿门闸（与缩略图 / 谏言候选同源）。
 * @param {string} factionId
 * @param {string} targetCityId
 * @param {string} [season]
 */
async function assertWarTargetJunClearance(factionId, targetCityId, season) {
  const { cityById } = await loadFootprintsAndCityByIdForSeason(season);
  const ev = evaluateWarJunClearance(targetCityId, cityById, factionId);
  if (!ev.ok) {
    throw new Error(ev.reason || '郡内清剿条件未满足');
  }
}

async function assertHostilePvpTargetInMapRange(factionId, targetCityId, season) {
  await assertWarTargetJunClearance(factionId, targetCityId, season);
  const { hostileCityIds } = await getProximityHighlightCityIds(factionId, season);
  const tid = String(targetCityId || '').trim();
  if (!tid || !new Set(hostileCityIds).has(tid)) {
    throw new Error('地图距离过远');
  }
}

async function assertNeutralPveTargetInMapRange(factionId, targetCityId, season) {
  await assertWarTargetJunClearance(factionId, targetCityId, season);
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
  assertWarTargetJunClearance,
  loadFootprintsAndCityByIdForSeason,
};
