/**
 * 战略大地图：从城池 footprint 沿道路格 BFS 泛洪，得到「控制区」立场（仅视觉）。
 * 与 `getStrategicCityLabelStance` 同色口径；匪寨 / 中立 / 停战 / 无路可达 → 不叠色。
 */

import { readStrategicCellAnchorId } from './strategicCellAnchorId.js';
import { isBanditMapObjectId } from './smallMapEnemyRoster.js';
import {
  strategicMapObjectIs2x2,
  buildStrategicRoadPaintBlockedLayers,
} from './strategicRoadOverlay.js';
import { buildRoadPassableKeySetForMarch } from './strategicMarchPoi.js';
import {
  getStrategicCityLabelStance,
  hexToRgba,
  STRATEGIC_CITY_LABEL_HEX,
} from './strategicMapCityLabelStance.js';

const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** 通用势力视为无归属，不参与泛洪源 */
const NEUTRAL_FACTION_IDS = new Set(['san_1_faction_0001']);

const TERRITORY_OVERLAY_ALPHA = 0.32;

/** 仅这三档渲染领土叠层 */
const OVERLAY_STANCES = new Set(['own', 'hostile', 'ally']);

function cellKey(gx, gy) {
  return `${gx},${gy}`;
}

function parseKey(k) {
  const [x, y] = String(k).split(',').map(Number);
  return { gx: x, gy: y };
}

function factionIdFromCityRow(row) {
  if (!row || typeof row !== 'object') return null;
  const fid = row.faction_id ?? row.factionId;
  if (fid == null || fid === '') return null;
  const s = String(fid).trim();
  if (!s || NEUTRAL_FACTION_IDS.has(s)) return null;
  return s;
}

/**
 * 收集有归属城池的 2×2 footprint 作为泛洪源。
 * @returns {Array<{ cityId: string, factionId: string, keys: Set<string> }>}
 */
export function collectStrategicTerritorySeedFootprints(cells, cityById, mapColumns, mapRows) {
  if (!cells?.length || !cityById) return [];
  const seenCity = new Set();
  const seeds = [];

  for (let gy = 0; gy < mapRows; gy++) {
    const row = cells[gy];
    if (!row) continue;
    for (let gx = 0; gx < mapColumns; gx++) {
      const cell = row[gx];
      const cityId = readStrategicCellAnchorId(cell);
      if (!cityId || seenCity.has(cityId)) continue;
      if (isBanditMapObjectId(cityId)) continue;
      if (!strategicMapObjectIs2x2(cell?.object)) continue;

      seenCity.add(cityId);
      const factionId = factionIdFromCityRow(cityById[cityId]);
      if (!factionId) continue;

      const keys = new Set();
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx >= 0 && ny >= 0 && nx < mapColumns && ny < mapRows) {
            keys.add(cellKey(nx, ny));
          }
        }
      }
      if (keys.size > 0) {
        seeds.push({ cityId, factionId, keys });
      }
    }
  }

  return seeds;
}

/**
 * 多源 BFS：沿 `roadPassable` 扩散；等距相遇的不同势力格标为 `null`（边界不叠色）。
 * @returns {Map<string, string|null>} `"gx,gy"` → 控制方 `faction_id` 或 `null`
 */
export function floodStrategicTerritoryOwners({
  cells,
  roadCells,
  cityById,
  mapColumns,
  mapRows,
}) {
  const owner = new Map();
  const dist = new Map();
  const queue = [];

  const roadPassable = buildRoadPassableKeySetForMarch(roadCells, cells, mapColumns, mapRows);
  const { bandit } = buildStrategicRoadPaintBlockedLayers(
    cells,
    mapColumns,
    mapRows,
  );

  const seeds = collectStrategicTerritorySeedFootprints(cells, cityById, mapColumns, mapRows);
  const seedFootprint = new Set();
  for (const s of seeds) {
    for (const k of s.keys) seedFootprint.add(k);
  }

  const canTraverse = (k) => {
    if (bandit.has(k)) return false;
    return roadPassable.has(k) || seedFootprint.has(k);
  };

  for (const s of seeds) {
    for (const k of s.keys) {
      if (bandit.has(k)) continue;
      if (!owner.has(k)) {
        owner.set(k, s.factionId);
        dist.set(k, 0);
        queue.push(k);
      }
    }
  }

  while (queue.length > 0) {
    const k = queue.shift();
    const d = dist.get(k);
    const f = owner.get(k);
    if (!f) continue;

    const { gx, gy } = parseKey(k);
    for (const [dx, dy] of DIRS4) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || ny < 0 || nx >= mapColumns || ny >= mapRows) continue;
      const nk = cellKey(nx, ny);
      if (!canTraverse(nk)) continue;

      const nd = d + 1;
      if (!owner.has(nk)) {
        owner.set(nk, f);
        dist.set(nk, nd);
        queue.push(nk);
        continue;
      }

      const existing = owner.get(nk);
      const existingD = dist.get(nk);
      if (existing === null) continue;

      if (existingD === nd && existing !== f) {
        owner.set(nk, null);
        continue;
      }

      if (existingD > nd) {
        owner.set(nk, f);
        dist.set(nk, nd);
        queue.push(nk);
      }
    }
  }

  // 匪寨占格、道路禁区内的非道路格：不显示控制色
  for (const k of bandit) {
    owner.delete(k);
  }

  return owner;
}

/**
 * @returns {Map<string, 'own'|'hostile'|'ally'>} 仅含需要叠色的格
 */
export function buildStrategicTerritoryStanceMap({
  cells,
  roadCells,
  cityById,
  mapColumns,
  mapRows,
  playerFactionId,
  allyFactionIds = null,
  nonHostileFactionIds = null,
}) {
  const pf =
    playerFactionId != null && String(playerFactionId).trim() !== ''
      ? String(playerFactionId).trim()
      : null;
  if (!pf || !cells?.length) return new Map();

  const owners = floodStrategicTerritoryOwners({
    cells,
    roadCells,
    cityById,
    mapColumns,
    mapRows,
  });

  const stanceMap = new Map();
  for (const [k, factionId] of owners) {
    if (!factionId) continue;
    const stance = getStrategicCityLabelStance({
      cityFactionId: factionId,
      playerFactionId: pf,
      allyFactionIds,
      nonHostileFactionIds,
    });
    if (stance && OVERLAY_STANCES.has(stance)) {
      stanceMap.set(k, stance);
    }
  }

  return stanceMap;
}

/**
 * @param {'own'|'hostile'|'ally'|null|undefined} stance
 * @returns {string|null} CSS rgba
 */
export function strategicTerritoryOverlayRgba(stance) {
  if (!stance || !OVERLAY_STANCES.has(stance)) return null;
  const hex = STRATEGIC_CITY_LABEL_HEX[stance];
  if (!hex) return null;
  return hexToRgba(hex, TERRITORY_OVERLAY_ALPHA);
}

export { hexToRgba, STRATEGIC_CITY_LABEL_HEX };
