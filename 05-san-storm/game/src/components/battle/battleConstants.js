/**
 * 战斗地图 UI 常量（格网尺寸与分区来自共享战术格网定义）
 */

export {
  TACTICAL_GRID_WIDTH as MAP_W,
  TACTICAL_GRID_HEIGHT as MAP_H,
  ZONE,
} from '@shared/utils/tacticalBattleGrid';

export const TILE_INFO = {
  forest: { badge: '🌲', name: '树林', attrs: '移动消耗 +1\n防御加成 +5%' },
  hill:   { badge: '⛰️', name: '丘陵', attrs: '移动消耗 +1\n防御加成 +10%\n高地优势' },
  waste:  { badge: '🏜️', name: '荒地', attrs: '移动消耗 +0\n无特殊效果' },
  rock:   { badge: '◼', name: '巨石', attrs: '不可通行\n不可破坏' },
  fence:  { badge: '🚧', name: '栅栏', attrs: '不可通行\n可破坏 HP 500' },
  trap:   { badge: '⚠️', name: '陷阱', attrs: '可通行 · 移动消耗 +0\n路过扣 50 兵力' },
  chest:  { badge: '📦', name: '宝箱', attrs: '可通行\n可互动获取奖励' },
};

/** 着火格：与林/丘移耗叠加；回合末烧兵（见 tacticalBattleEngine + getMoveCost） */
const FIRE_ATTRS_EXTRA_MOVE = '进入着火格额外消耗移动力 +2（与树林/丘陵底层移耗叠加）';
const FIRE_ATTRS_END_TURN = '每回合结束时损失当前兵力 20%（无视防御）';

/**
 * 战术格：地形 + 可选对象 + 是否着火 → 与 TileTooltipContent 一致的 { badge, name, attrs }
 * @param {{ terrain?: string, obj?: { type?: string } | null, cellOnFire?: boolean }} p
 * @returns {{ badge: string, name: string, attrs: string } | null}
 */
export function buildTacticalTileTooltipInfo({ terrain, obj, cellOnFire }) {
  const onFire = !!cellOnFire;
  let base = null;
  if (obj && obj.type && TILE_INFO[obj.type]) {
    base = TILE_INFO[obj.type];
    if (!onFire) return base;
    return {
      badge: '🔥',
      name: `${base.name}（着火）`,
      attrs: `${base.attrs}\n${FIRE_ATTRS_EXTRA_MOVE}\n${FIRE_ATTRS_END_TURN}`,
    };
  }
  const t = terrain;
  if (t === 'forest' || t === 'hill') {
    base = TILE_INFO[t];
    if (!onFire) return base;
    const extraLines = base.attrs.split('\n').slice(1).join('\n');
    const terrainLabel = t === 'forest' ? '树林' : '丘陵';
    return {
      badge: '🔥',
      name: `${base.name}（着火）`,
      attrs: `移动消耗 +3（${terrainLabel} +1，着火 +2）\n${extraLines}\n${FIRE_ATTRS_END_TURN}`,
    };
  }
  if (t === 'waste') {
    base = TILE_INFO.waste;
    if (!onFire) return null;
    return {
      badge: '🔥',
      name: `${base.name}（着火）`,
      attrs: `移动消耗 +3（与平原相同 +1，着火 +2）\n无地形防御加成\n${FIRE_ATTRS_END_TURN}`,
    };
  }
  if (onFire) {
    return {
      badge: '🔥',
      name: '着火地形',
      attrs: `移动消耗 +2（相对平原：着火 +2）\n${FIRE_ATTRS_END_TURN}`,
    };
  }
  return null;
}

/** 战役战略格 object → TILE_INFO 键（与 buildCampaignBattleMapResult 一致） */
export function campaignObjectToTileInfoKey(objectId) {
  if (!objectId) return null;
  const id = String(objectId);
  if (id === 'fence') return 'fence';
  if (id === 'trap') return 'trap';
  if (id === 'chest') return 'chest';
  if (id === 'rock' || id === 'military_tower' || id === 'military_camp') return 'rock';
  return null;
}

/**
 * 战役大地图格子 tooltip（terrain/object/effect）
 * @param {{ terrain?: string, object?: string, effect?: string }} cell
 */
export function buildCampaignCellTooltipInfo(cell) {
  const onFire = cell?.effect === 'fire';
  const objKey = campaignObjectToTileInfoKey(cell?.object);
  if (objKey && TILE_INFO[objKey]) {
    const base = TILE_INFO[objKey];
    if (!onFire) return base;
    return {
      badge: '🔥',
      name: `${base.name}（着火）`,
      attrs: `${base.attrs}\n${FIRE_ATTRS_EXTRA_MOVE}\n${FIRE_ATTRS_END_TURN}`,
    };
  }
  const ter = cell?.terrain;
  if (ter === 'forest' || ter === 'hill') {
    return buildTacticalTileTooltipInfo({ terrain: ter, obj: null, cellOnFire: onFire });
  }
  if (onFire) {
    return buildTacticalTileTooltipInfo({ terrain: 'plain', obj: null, cellOnFire: true });
  }
  if (ter === 'river' || ter === 'lake') {
    return { badge: '🌊', name: '水域', attrs: '不可通行' };
  }
  return null;
}

export const TYPE_LABEL = { infantry: '步兵', archer: '弓兵', cavalry: '骑兵', special: '特殊' };
export const RARITY_LABEL = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
export const FACTION_COLOR = { player: '#5ab0ff', ally: '#4ade80', enemy: '#ff7060' };

/**
 * 战术图名条上「士气」数字的 inline 色（仅普通单位）。
 * boss / hero / 主公槽由 `.is-commander-boss` 等 CSS 18K 金覆盖，不用此函数。
 * 规则：≤20 红，≥80 绿，其余（20～80 之间）白。
 */
export function moraleInlineColorForTroopBar(morale) {
  const m = Number(morale ?? 0);
  if (m <= 20) return '#F44336';
  if (m >= 80) return '#4CAF50';
  return '#FFFFFF';
}

/**
 * 根据部队对象构建 tooltip 内容，供 BattleMap 与 CampaignMapGrid 共用。
 * 纯函数，无副作用。
 *
 * @param {object} troop - 战斗部队对象（含 faction/rarity/troopType/character 等字段）
 * @returns {{ type: 'troop', troop, fc, hpPct, rarityName, typeName, charLine, critDodge, isEnemy }}
 */
export function buildTroopTooltipContent(troop) {
  const fc = FACTION_COLOR[troop.faction] || '#ccc';
  const hpPct = Math.round((troop.currentTroops / troop.maxTroops) * 100);
  const rarityName = RARITY_LABEL[troop.rarity] || troop.rarity;
  const typeName = TYPE_LABEL[troop.troopType] || troop.troopType;
  const ch = troop.character;
  const charDisplay = ch && (ch.courtesyName || ch.name || ch.courtesy_name || ch.character_name);
  const charLine = charDisplay ? `将领: ${charDisplay}` : null;
  const critDodge = ch
    ? {
        crit: (((Number(ch.courage) || 0) + (Number(ch.luck) || 0)) / 80 * 100).toFixed(1),
        dodge: (Number(ch.luck) || 0).toFixed(1),
      }
    : null;
  return { type: 'troop', troop, fc, hpPct, rarityName, typeName, charLine, critDodge, isEnemy: troop.faction === 'enemy' };
}

/** 图片路径基础 */
export const ASSET_BASE = `${import.meta.env.BASE_URL}assets/san_1_map/`;

/** 着火特效帧 1~12（tile_3_effect/fire_frame_XX.png） */
export function tacticalFireFrameUrl(frameIndex1Based) {
  const n = Math.max(1, Math.min(12, frameIndex1Based));
  return `${ASSET_BASE}tile_3_effect/fire_frame_${String(n).padStart(2, '0')}.png`;
}

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
