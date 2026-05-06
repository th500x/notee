/**
 * 战斗地图 UI 常量（格网尺寸与分区来自共享战术格网定义）
 */
import { getTacticalActiveSkillCastRange } from '@shared/utils/tacticalSkillCastRange';
import {
  getEffectiveCritRateFromCharacter,
  getEffectiveDodgeRateFromCharacter,
} from '@/systems/combatSystem';

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
  city_major: { badge: '🏛️', name: '大城', attrs: '战略层城点（测试）\n可通行' },
  city_medium: { badge: '🏯', name: '中城', attrs: '战略层城点（测试）\n可通行' },
  city_small: { badge: '🏘️', name: '小城', attrs: '战略层城点（测试）\n可通行' },
  gate: { badge: '🚩', name: '关隘', attrs: '战略层城点（测试）\n可通行' },
  fort: { badge: '🏰', name: '预设据点（空地）', attrs: '可建造 fort 槽位（战略层）\n可通行' },
  bandit_camp: { badge: '⚔', name: '匪寨', attrs: '战略 POI（阶段一占位）\n可通行至寨心' },
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
  if (id === 'city_major') return 'city_major';
  if (id === 'city_medium') return 'city_medium';
  if (id === 'city_small') return 'city_small';
  if (id === 'gate') return 'gate';
  if (id === 'fort') return 'fort';
  if (id === 'bandit_horiz' || id === 'bandit_vert') return 'bandit_camp';
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
    let base = TILE_INFO[objKey];
    if (cell?.cityId || cell?.cityName) {
      const idLine = cell.cityId ? `配置 ID：${cell.cityId}` : '';
      const posLine =
        cell.col != null && cell.row != null ? `郡内格：gx = ${cell.col}, gy = ${cell.row}` : '';
      base = {
        ...base,
        attrs: [idLine, posLine].filter(Boolean).join('\n'),
      };
    }
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
  /** 战略大地图：preset 中 object 类型未列入 TILE_INFO 时仍可能有 cityId，避免无 tooltip、无法合并运行时 */
  if (cell?.cityId || cell?.cityName) {
    const idLine = cell.cityId ? `配置 ID：${cell.cityId}` : '';
    const posLine =
      cell.col != null && cell.row != null ? `郡内格：gx = ${cell.col}, gy = ${cell.row}` : '';
    const typeLine = cell.object ? `对象类型：${cell.object}` : '';
    return {
      badge: '📍',
      name: cell.cityName || cell.cityId || '战略点',
      attrs: [typeLine, idLine, posLine].filter(Boolean).join('\n'),
    };
  }
  return null;
}

export const TYPE_LABEL = { infantry: '步兵', archer: '弓兵', cavalry: '骑兵', special: '特殊' };
export const RARITY_LABEL = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
export const FACTION_COLOR = { player: '#5ab0ff', ally: '#4ade80', enemy: '#ff7060' };

/**
 * 阶段4/5 伤害技：`target_range` 在棋盘上展开的作用格数/语义（与「锚点可达曼哈顿格数」无关）。
 * 与 `shared/utils/skillPhase4ActiveDamage.js` 中 `cellsForPhase4TargetPattern` / `pickPhase4LineCellsForAnchor` 一致。
 */
export function buildSkillShapeRangeDescription(slot) {
  const tr = String(slot?.targetRange || '').toLowerCase();
  if (tr === 'line') {
    return '作用形状：直线共 3 格（锚点居中，向两侧各 1 格；横/竖取命中敌军较多的一侧）';
  }
  if (tr === 'cross') {
    return '作用形状：十字至多 5 格（锚点 + 四正交相邻）';
  }
  if (tr === 'square') {
    return '作用形状：2×2 田字共 4 格（锚点为左上）';
  }
  if (tr === 'single') {
    return '作用形状：单体 1 格（仅锚点格）';
  }
  if (tr === 'random') {
    return '作用形状：随机多目标（目标均在「锚点可达距离」曼哈顿池内抽取）';
  }
  return `作用形状代码：${slot?.targetRange || '—'}`;
}

/** 手动伤害技预览：锚点射程（技能 ID）+ 作用形状说明（勿与直线 3 格混淆） */
export function buildSkillDamagePreviewMetaLines(slot) {
  if (!slot) return [];
  const castCells = getTacticalActiveSkillCastRange(slot.skillId);
  return [
    `技能：${slot.name || '—'}`,
    `锚点可达距离（曼哈顿）：${castCells} 格（施法者→可选锚点敌军格；由技能 ID 稀有度千位决定，与后端一致）`,
    buildSkillShapeRangeDescription(slot),
  ];
}

/**
 * 战术图名条上「士气」数字的 inline 色（仅普通单位）。
 * boss / hero / 主公槽由 `.is-commander-boss` 等 CSS 18K 金覆盖，不用此函数。
 * 整数点档位：＜40 红，40～59 琥珀，60～79 白，≥80 绿。
 */
export function moraleInlineColorForTroopBar(morale) {
  const m = Number(morale ?? 0);
  if (m < 40) return '#F44336';
  if (m < 60) return '#FFC107';
  if (m < 80) return '#FFFFFF';
  return '#4CAF50';
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
        crit: (getEffectiveCritRateFromCharacter(ch) * 100).toFixed(1),
        dodge: (getEffectiveDodgeRateFromCharacter(ch) * 100).toFixed(1),
      }
    : null;
  return { type: 'troop', troop, fc, hpPct, rarityName, typeName, charLine, critDodge, isEnemy: troop.faction === 'enemy' };
}

/**
 * 手动行动阶段：主动技预览（**治疗**）浮层内容，
 * 与 `TileTooltipContent` 中部队块同源（`.tt-name` + `.tt-attrs`），由 `AttackPreview` 对治疗路径挂 body portal 复用。
 * 形状/随机**伤害**预览已改用 `ManualAttackPreviewPanel` 与普攻同位，不再经本函数 `kind: 'shape'` / `randomStrike` 分支（保留供旧调用或调试）。
 *
 * @param {{
 *   kind: 'shape',
 *   slot: object,
 *   victimLines: string[],
 *   casterTroop: object|null,
 *   footerHint?: string,
 * } | {
 *   kind: 'heal',
 *   slot: object,
 *   selfGain: number,
 *   allyGain: number,
 *   casterTroop?: object|null,
 *   phase5HealDamage?: boolean,
 *   footerHint?: string,
 * } | {
 *   kind: 'randomStrike',
 *   slot: object,
 *   estimate: { damage: number, hitRate: number, critRate: number },
 *   footerHint?: string,
 * }} payload
 */
export function buildManualActiveSkillPreviewTooltipContent(payload) {
  const footer =
    payload.footerHint ??
    (payload.kind === 'heal' && payload.phase5HealDamage
      ? '再次点击确认：先回复再追击敌军'
      : payload.kind === 'heal'
        ? '再次点击确认施放'
        : payload.kind === 'randomStrike'
          ? '再次点击确认（目标随机抽取）'
          : '再次点击锚点格确认施放');

  if (payload.kind === 'shape') {
    const isStrategy = String(payload.slot?.damageType || '').toLowerCase() === 'strategy';
    const casterName =
      payload.casterTroop?.displayName ||
      payload.casterTroop?.name ||
      '我军';
    const skillName = payload.slot?.name || '主动技';
    const lines = payload.victimLines?.length ? payload.victimLines.join('\n') : '';
    const attrs = [lines, `施放者: ${casterName}`, footer].filter(Boolean).join('\n\n');
    return {
      type: 'manualSkill',
      title: `${skillName}（范围）`,
      titleColor: isStrategy ? '#7dd3fc' : '#e2e8f0',
      attrs,
    };
  }

  if (payload.kind === 'heal') {
    const parts = [];
    if (payload.selfGain > 0) parts.push(`自军 +${payload.selfGain}`);
    if (payload.allyGain > 0) parts.push(`目标 +${payload.allyGain}`);
    const casterName =
      payload.casterTroop?.displayName ||
      payload.casterTroop?.character?.courtesyName ||
      payload.casterTroop?.name ||
      '';
    const head = casterName ? `施放者: ${casterName}\n\n` : '';
    const attrs = `${head}${parts.join('  ·  ')}\n\n${footer}`;
    return {
      type: 'manualSkill',
      title: `💚 ${payload.slot?.name || '治疗'}`,
      titleColor: '#7fefa8',
      attrs,
    };
  }

  if (payload.kind === 'randomStrike') {
    const isStrategy = String(payload.slot?.damageType || '').toLowerCase() === 'strategy';
    const est = payload.estimate;
    const casterName =
      payload.casterTroop?.displayName ||
      payload.casterTroop?.character?.courtesyName ||
      payload.casterTroop?.name ||
      '';
    const lines = [];
    if (casterName) lines.push(`施放者: ${casterName}`);
    lines.push('参考目标（其一）预估');
    lines.push(`伤害 ~${est.damage}`);
    lines.push(`命中 ${(est.hitRate * 100).toFixed(1)}% · 暴击 ${(est.critRate * 100).toFixed(1)}%`);
    lines.push(footer);
    const attrs = lines.join('\n');
    return {
      type: 'manualSkill',
      title: `⚡ ${payload.slot?.name || '技能'}（随机多目标）`,
      titleColor: isStrategy ? '#7dd3fc' : '#e2e8f0',
      attrs,
    };
  }

  return null;
}

/**
 * 小型/大型地图共用的 tile-tooltip 位移。
 * 部队 tooltip 一律在指针**上方**展开，避免敌方原先「向下」偏移在靠近视口底边时裁切射程等末行。
 */
export function tooltipTransformForContent(content) {
  if (
    content?.type === 'troop' ||
    content?.type === 'manualSkill' ||
    content?.type === 'attackPreviewPortal'
  ) {
    return 'translate(-50%, calc(-100% - 10px))';
  }
  if (content?.isEnemy) {
    return 'translate(-50%, 10px)';
  }
  return 'translate(-50%, calc(-100% - 10px))';
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
