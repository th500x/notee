/**
 * 战斗地图常量
 * 从 demo/map-generator-demo.html 提取
 */

export const MAP_W = 8;
export const MAP_H = 10;
export const ZONE = { deployA: [0, 1, 2], combat: [3, 4, 5, 6], deployB: [7, 8, 9] };

export const TILE_INFO = {
  forest: { badge: '🌲', name: '树林', attrs: '移动消耗 +1\n防御加成 +5%' },
  hill:   { badge: '⛰️', name: '丘陵', attrs: '移动消耗 +1\n防御加成 +10%\n高地优势' },
  waste:  { badge: '🏜️', name: '荒地', attrs: '移动消耗 +0\n无特殊效果' },
  rock:   { badge: '◼', name: '巨石', attrs: '不可通行\n不可破坏' },
  fence:  { badge: '🚧', name: '栅栏', attrs: '不可通行\n可破坏 HP 500' },
  trap:   { badge: '⚠️', name: '陷阱', attrs: '可通行 · 移动消耗 +0\n路过扣 50 兵力' },
  chest:  { badge: '📦', name: '宝箱', attrs: '可通行\n可互动获取奖励' },
};

export const TYPE_LABEL = { infantry: '步兵', archer: '弓兵', cavalry: '骑兵', special: '特殊' };
export const RARITY_LABEL = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
export const FACTION_COLOR = { player: '#5ab0ff', enemy: '#ff7060' };

/** 图片路径基础 */
export const ASSET_BASE = `${import.meta.env.BASE_URL}assets/san_1_map/`;

/** 获取底色图片路径 */
export function getBg(terrain, variants, isChest) {
  const p = variants.bgTheme === 'wasteland' ? 'plain_wasteland' : 'plain_grassland';
  return `${ASSET_BASE}tile_1_bg/${isChest ? p + '_chest.png' : p + '_' + variants.bgVariant + '.png'}`;
}

/** 获取地形叠加图片路径 */
export function getTerrain(terrain, variants) {
  if (terrain === 'forest') return `${ASSET_BASE}tile_2_terrain/forest_${variants.forest}.png`;
  if (terrain === 'hill') return `${ASSET_BASE}tile_2_terrain/hill_${variants.hill}.png`;
  return null;
}

/** 获取对象图片路径 */
export function getObj(type, isOpen) {
  const m = { rock: 'rock_01.png', fence: 'fence_01.png', trap: 'trap_01.png', chest: isOpen ? 'chest_01_op.png' : 'chest_01_cl.png' };
  return `${ASSET_BASE}tile_3_object/${m[type]}`;
}
