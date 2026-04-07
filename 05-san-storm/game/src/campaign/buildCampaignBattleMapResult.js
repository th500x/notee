/**
 * 战役战斗：将整图 16×20 `cells` 转为回合引擎用的 `mapResult`（terrain / objects）。
 * 坐标与战略格一致：x=列 col，y=行 row，与 `battleTroops[].x` / `.y` 一致。
 */

import { OBJECT_TYPES } from '@shared/utils/mapGenerator';

/** @param {string} campaignTerrain @param {string} [base] */
function toEngineTerrain(campaignTerrain, base) {
  if (!campaignTerrain) {
    if (base && String(base).includes('wasteland')) return 'waste';
    return 'plain';
  }
  const t = String(campaignTerrain);
  if (t === 'river' || t === 'lake') return 'river';
  if (t === 'forest') return 'forest';
  if (t === 'hill') return 'hill';
  if (t === 'siege') return 'plain';
  return 'plain';
}

/**
 * @param {string} objectId
 * @returns {keyof typeof OBJECT_TYPES | null}
 */
function campaignObjectToEngineType(objectId) {
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
 * @param {{ cells: object[][], seed?: number }} campaignMapSim
 */
export function buildCampaignBattleMapResult(campaignMapSim) {
  const cells = campaignMapSim?.cells;
  if (!cells?.length || !cells[0]?.length) {
    return {
      terrain: [],
      cellFire: [],
      variants: { bgTheme: 'grassland', bgVariant: '01', forest: '01', hill: '01' },
      objects: [],
      meta: { seed: campaignMapSim?.seed ?? 0, campaignFullBattleGrid: true },
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
      const oid = campaignObjectToEngineType(cell.object);
      if (oid && OBJECT_TYPES[oid]) {
        objects.push({
          type: oid,
          x: col,
          y: row,
          ...OBJECT_TYPES[oid],
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
      seed: campaignMapSim.seed ?? 0,
      campaignFullBattleGrid: true,
      grid: { w, h },
    },
  };
}
