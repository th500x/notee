/**
 * 战略缩略图：距「我方城池」最近的至多 3 座敌对城、至多 3 座中立**城**（仅大/中/小；与 `isAllowedPlayerCityPoiCityType` 一致）。
 *
 * 距离：各城 2×2 footprint 几何中心之间的曼哈顿距；对候选城取到任意己方城的最小值后全局排序取前 N。
 * 另过滤大/中城郡内清剿门闸（`warJunClearanceGate` · 17-3 §3.4）。
 * 与 `game` 原实现一致；抽至 shared 供前后端共用。
 */

const TOP_N = 3;

import { isAllowedPlayerCityPoiCityType } from './strategicMarchPoi.js';
import { getStrategicCityLabelStance } from './strategicMapCityLabelStance.js';
import { warTargetPassesJunClearance } from './warJunClearanceGate.js';

function footprintCenter(fp) {
  const w = Number(fp.widthCells) || 2;
  const h = Number(fp.heightCells) || 2;
  return {
    cx: Number(fp.anchorGx) + w / 2,
    cy: Number(fp.anchorGy) + h / 2,
  };
}

function manhattan(a, b) {
  return Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
}

/**
 * @param {Array<{ cityId: string, anchorGx: number, anchorGy: number, widthCells: number, heightCells: number }>} footprints
 * @param {Record<string, object>} cityById
 * @param {string|null|undefined} playerFactionId
 * @param {Set<string>|string[]|null|undefined} allyFactionIds
 * @param {Set<string>|string[]|null|undefined} nonHostileFactionIds
 * @returns {{ hostileCityIds: string[], neutralCityIds: string[] }}
 */
export function computeStrategicMiniMapProximityHighlights(
  footprints,
  cityById,
  playerFactionId,
  allyFactionIds = null,
  nonHostileFactionIds = null,
) {
  const pf = playerFactionId != null && String(playerFactionId).trim() !== '' ? String(playerFactionId) : null;
  if (!pf || !Array.isArray(footprints) || !footprints.length) {
    return { hostileCityIds: [], neutralCityIds: [] };
  }
  const byId = cityById && typeof cityById === 'object' ? cityById : {};
  const own = [];
  const hostile = [];
  const neutral = [];

  for (const fp of footprints) {
    const cid = String(fp.cityId || '').trim();
    if (!cid) continue;
    const row = byId[cid];
    const fid = row?.faction_id ?? row?.factionId ?? null;
    const stance = getStrategicCityLabelStance({
      cityFactionId: fid,
      playerFactionId: pf,
      allyFactionIds,
      nonHostileFactionIds,
    });
    const c = footprintCenter(fp);
    const entry = { cityId: cid, ...c };
    const ct = row?.city_type ?? row?.cityType ?? null;
    if (stance === 'own') own.push(entry);
    else if (stance === 'hostile') hostile.push(entry);
    else if (stance === 'neutral' && isAllowedPlayerCityPoiCityType(ct)) neutral.push(entry);
  }

  if (!own.length) {
    return { hostileCityIds: [], neutralCityIds: [] };
  }

  function minDistToOwn(t) {
    let dmin = Infinity;
    for (const o of own) {
      dmin = Math.min(dmin, manhattan(o, t));
    }
    return dmin;
  }

  function pickNearestCityIds(candidates) {
    if (!candidates.length) return [];
    const scored = candidates.map((t) => ({
      cityId: t.cityId,
      d: minDistToOwn(t),
    }));
    scored.sort((a, b) => {
      if (a.d !== b.d) return a.d - b.d;
      return String(a.cityId).localeCompare(String(b.cityId));
    });
    const out = [];
    const seen = new Set();
    for (const { cityId } of scored) {
      const id = String(cityId);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= TOP_N) break;
    }
    return out;
  }

  // 大/中城郡内清剿门闸（17-3）：未清剿者不得进入「最近 3」提示与开战候选
  const hostileEligible = hostile.filter((t) => warTargetPassesJunClearance(t.cityId, byId, pf));
  const neutralEligible = neutral.filter((t) => warTargetPassesJunClearance(t.cityId, byId, pf));

  return {
    hostileCityIds: pickNearestCityIds(hostileEligible),
    neutralCityIds: pickNearestCityIds(neutralEligible),
  };
}
