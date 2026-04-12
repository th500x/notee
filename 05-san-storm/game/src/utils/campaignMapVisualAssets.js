/**
 * 战役地图 Demo 视觉：与 Event 战斗 BattleTile 同源路径（assets/san_1_map）。
 * @see docs/tools/campaign/CAMPAIGN_MAP.md
 */

import { ASSET_BASE } from '@/components/battle/battleConstants';

/** 与生成器 seed 对齐，为各层选 01~05 变体（确定性） */
export function buildCampaignVisualVariants(seed) {
  const s = Number(seed) || 0;
  const v = (k) => {
    let h = Math.imul(s ^ (k * 0x9e3779b9), 0x85ebca6b);
    h ^= h >>> 13;
    return (Math.abs(h) % 5) + 1;
  };
  const pad = (n) => String(n).padStart(2, '0');
  return {
    bgGrass: pad(v(1)),
    bgWaste: pad(v(2)),
    forest: pad(v(3)),
    hill: pad(v(4)),
    siege: pad(v(5)),
  };
}

export function campaignBgUrl(base, bgVariant) {
  const isWaste = base === 'plain_wasteland';
  const prefix = isWaste ? 'plain_wasteland' : 'plain_grassland';
  return `${ASSET_BASE}tile_1_bg/${prefix}_${bgVariant}.png`;
}

/** @param {string|null|undefined} terrain - forest|hill|siege|river|lake|ford|road */
export function campaignTerrainUrl(terrain, variants) {
  if (!terrain) return null;
  if (terrain === 'forest') return `${ASSET_BASE}tile_2_terrain/forest_${variants.forest}.png`;
  if (terrain === 'hill') return `${ASSET_BASE}tile_2_terrain/hill_${variants.hill}.png`;
  if (terrain === 'siege') return `${ASSET_BASE}tile_2_terrain/siege_${variants.siege}.png`;
  if (terrain === 'river') return `${ASSET_BASE}tile_2_terrain/river_01.png`;
  return null;
}

/** 无 PNG 的地形用 CSS 类名（由格子 div 表现） */
export function terrainFallbackClass(terrain) {
  if (terrain === 'lake') return 'camp-terrain-fallback camp-terrain-lake';
  if (terrain === 'ford') return 'camp-terrain-fallback camp-terrain-ford';
  if (terrain === 'road') return 'camp-terrain-fallback camp-terrain-road';
  return null;
}

/**
 * @param {string|null|undefined} objectType
 * @param {{ buildStatus?: string, build_status?: string }} [opts] - 仅 **fort**：`built` 用建成图，否则空置图
 */
export function campaignObjectUrl(objectType, opts = {}) {
  if (!objectType) return null;
  if (objectType === 'fort') {
    const st = opts.buildStatus ?? opts.build_status;
    const file = st === 'built' ? 'city_fort_01_built.png' : 'city_fort_01_empty.png';
    return `${ASSET_BASE}tile_3_object/${file}`;
  }
  const m = {
    fence: 'fence_01.png',
    rock: 'rock_01.png',
    trap: 'trap_01.png',
    military_tower: 'military_tower_01.png',
    military_camp: 'military_camp_01.png',
    city_major: 'city_major_01.png',
    city_medium: 'city_medium_01.png',
    city_small: 'city_small_01.png',
    gate: 'city_gate_01.png',
  };
  const file = m[objectType];
  if (!file) return null;
  return `${ASSET_BASE}tile_3_object/${file}`;
}

/** 战略大地图（31-5）：城 / 关隘 / 据点 PNG 为 2×2 格锚点左上，非单格 */
export function strategicMapObjectIs2x2(objectType) {
  if (!objectType) return false;
  return (
    objectType === 'city_small' ||
    objectType === 'city_medium' ||
    objectType === 'city_major' ||
    objectType === 'gate' ||
    objectType === 'fort'
  );
}

export const CAMPAIGN_MAP_W = 16;
export const CAMPAIGN_MAP_H = 20;
