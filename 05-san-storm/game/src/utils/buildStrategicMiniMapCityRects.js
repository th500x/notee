/**
 * 战略缩略图：城块填色与大地图城名条立场色一致（`getStrategicCityLabelStance`）。
 */

import {
  getStrategicCityLabelStance,
  STRATEGIC_CITY_LABEL_HEX,
} from '@/utils/strategicMapCityLabelStance';

const PAD = 0.07;

/**
 * @param {Array<{ cityId: string, anchorGx: number, anchorGy: number, widthCells: number, heightCells: number }>} footprints
 * @param {Record<string, object>} cityById
 * @param {string|null|undefined} playerFactionId
 * @param {Set<string>|string[]|null|undefined} allyFactionIds
 * @param {Set<string>|string[]|null|undefined} nonHostileFactionIds
 * @returns {Array<{ cityId: string, x: number, y: number, w: number, h: number, fill: string, stroke: string }>}
 */
export function buildStrategicMiniMapCityRects(
  footprints,
  cityById,
  playerFactionId,
  allyFactionIds = null,
  nonHostileFactionIds = null,
) {
  const list = Array.isArray(footprints) ? footprints : [];
  const byId = cityById && typeof cityById === 'object' ? cityById : {};
  const out = [];
  for (const fp of list) {
    const row = byId[fp.cityId];
    const fid = row?.faction_id ?? row?.factionId ?? null;
    const stance = getStrategicCityLabelStance({
      cityFactionId: fid,
      playerFactionId,
      allyFactionIds,
      nonHostileFactionIds,
    });
    let fill = '#64748b';
    if (stance && STRATEGIC_CITY_LABEL_HEX[stance]) {
      fill = STRATEGIC_CITY_LABEL_HEX[stance];
    } else if (!playerFactionId) {
      fill = '#57534e';
    }
    out.push({
      cityId: fp.cityId,
      x: fp.anchorGx + PAD,
      y: fp.anchorGy + PAD,
      w: fp.widthCells - PAD * 2,
      h: fp.heightCells - PAD * 2,
      fill,
      stroke: 'rgba(12,10,9,0.72)',
    });
  }
  return out;
}
