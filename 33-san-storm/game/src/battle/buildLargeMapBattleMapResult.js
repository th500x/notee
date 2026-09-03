/**
 * 大型图战斗：将整图 `cells` 转为回合引擎用的 `mapResult`（terrain / objects）。
 * 坐标与战略格一致：x=列 col，y=行 row，与 `battleTroops[].x` / `.y` 一致。
 */

import { GAMEPLAY_OBJECT_DEFS } from '@shared/utils/terrainGameplayObjects.js';

/** @param {string} cellTerrain @param {string} [base] */
function toEngineTerrain(cellTerrain, base) {
  if (!cellTerrain) {
    if (base && String(base).includes('wasteland')) return 'waste';
    return 'plain';
  }
  const t = String(cellTerrain);
  if (t === 'river' || t === 'lake') return 'river';
  if (t === 'forest') return 'forest';
  if (t === 'hill') return 'hill';
  if (t === 'siege') return 'plain';
  return 'plain';
}

/**
 * @param {string} objectId
 * @returns {keyof typeof GAMEPLAY_OBJECT_DEFS | null}
 */
function mapObjectToEngineType(objectId) {
  if (!objectId) return null;
  const id = String(objectId);
  if (id === 'fence') return 'fence';
  if (id === 'rock' || id === 'military_tower') return 'rock';
  if (id === 'trap') return 'trap';
  if (id === 'chest') return 'chest';
  if (id === 'military_camp') return 'rock';
  return 'rock';
}

/**
 * @param {{ cells: object[][], seed?: number }} mapSim
 */
export function buildLargeMapBattleMapResult(mapSim) {
  const cells = mapSim?.cells;
  if (!cells?.length || !cells[0]?.length) {
    return {
      terrain: [],
      cellFire: [],
      variants: { bgTheme: 'grassland', bgVariant: '01', forest: '01', hill: '01' },
      objects: [],
      meta: { seed: mapSim?.seed ?? 0, fullBattleGrid: true },
    };
  }

  const h = cells.length;
  const w = cells[0].length;
  const terrain = Array.from({ length: h }, () => Array.from({ length: w }, () => 'plain'));
  const cellFire = Array.from({ length: h }, () => Array.from({ length: w }, () => false));
  const objects = [];

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const cell = cells[row]?.[col];
      if (!cell) continue;
      terrain[row][col] = toEngineTerrain(cell.terrain, cell.base);
      if (cell.effect === 'fire') cellFire[row][col] = true;
      const oid = mapObjectToEngineType(cell.object);
      if (oid && GAMEPLAY_OBJECT_DEFS[oid]) {
        objects.push({
          type: oid,
          x: col,
          y: row,
          ...GAMEPLAY_OBJECT_DEFS[oid],
          ...(oid === 'chest' ? { isOpen: false, rewardRarity: 'common' } : {}),
        });
      }
    }
  }

  return {
    terrain,
    cellFire,
    variants: {
      bgTheme: 'grassland',
      bgVariant: '01',
      forest: '01',
      hill: '01',
    },
    objects,
    meta: {
      seed: mapSim.seed ?? 0,
      fullBattleGrid: true,
      grid: { w, h },
    },
  };
}
