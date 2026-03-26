/**
 * battleMapBuilder.js
 *
 * 将 mapGenerator.js 的输出转换为 BattleMap 类所需的格式。
 *
 * 用法：
 *   import { buildBattleMap } from '@/utils/battleMapBuilder';
 *   const mapData = buildBattleMap({ seed: 42, battleRarity: 'epic' });
 *   const battleMap = new BattleMap(mapData);
 *
 * @see docs/90-assets/91-2-MAP_AUTO_GENERATION.md
 */

import { generateSmallMap, TERRAIN, ZONE } from '@shared/utils/mapGenerator';

// ── 地形属性表 ────────────────────────────────────────────────────────────────

const TERRAIN_PROPS = {
  [TERRAIN.PLAIN]:  { moveCost: 1, defensiveBonus: 0, elevation: 0 },
  [TERRAIN.FOREST]: { moveCost: 2, defensiveBonus: 15, elevation: 0 },
  [TERRAIN.HILL]:   { moveCost: 2, defensiveBonus: 20, elevation: 1 },
  [TERRAIN.WASTE]:  { moveCost: 1, defensiveBonus: 0,  elevation: 0 },
};

// ── 主函数 ────────────────────────────────────────────────────────────────────

/**
 * 生成战斗地图数据
 *
 * @param {object} options
 * @param {number|null} options.seed          - 随机种子（null = 随机）
 * @param {string}      options.battleRarity  - 战斗稀有度 'common'|'rare'|'epic'|'legendary'
 * @param {string|null} options.bgTheme       - 底色主题 'grassland'|'wasteland'|null（null=随机）
 * @param {string|null} options.mapId         - 地图ID（null = 自动生成）
 * @param {string|null} options.bossId        - 主将ID（有值时增加"消灭主将"胜利条件）
 * @returns {object} BattleMap 构造函数所需的 mapData 对象
 */
export function buildBattleMap({
  seed         = null,
  battleRarity = 'common',
  bgTheme      = null,
  mapId        = null,
  bossId       = null,
} = {}) {
  const result = generateSmallMap({ seed, battleRarity, bgTheme });
  const { terrain, variants, objects, meta } = result;

  // ── Terrain 层 ──────────────────────────────────────────────────────────
  const terrainLayer = terrain.map((row, y) =>
    row.map((type, x) => {
      const props = TERRAIN_PROPS[type] || TERRAIN_PROPS[TERRAIN.PLAIN];
      // 宝箱格子使用专用底板
      const hasChest = objects.some(o => o.type === 'chest' && o.x === x && o.y === y);
      return {
        type,
        variant:        variants,          // 整张地图共用同一套变体
        elevation:      props.elevation,
        moveCost:       props.moveCost,
        defensiveBonus: props.defensiveBonus,
        isPassable:     true,              // 小型地图所有地形均可通行
        isDeployable:   ZONE.deployA.includes(y) || ZONE.deployB.includes(y),
        isChestCell:    hasChest,          // 底板切换为 *_chest.png
      };
    })
  );

  // ── Objects 层 ──────────────────────────────────────────────────────────
  const objectsLayer = objects.map(obj => ({
    type:           obj.type,
    position:       { x: obj.x, y: obj.y },
    isPassable:     obj.isPassable,
    isDestructible: obj.isDestructible,
    isInteractable: obj.isInteractable || false,
    hp:             obj.hp ?? null,
    trapDamage:     obj.trapDamage ?? null,
    isOpen:         obj.isOpen ?? false,
    rewardRarity:   obj.rewardRarity ?? null,
  }));

  // ── 胜利/失败条件 ────────────────────────────────────────────────────────
  const victoryConditions = [
    { type: 1, description: '消灭所有敌军' },
  ];
  if (bossId) {
    victoryConditions.push({ type: 5, targetId: bossId, description: '消灭敌方主将' });
  }

  return {
    mapId:      mapId || `auto_${meta.seed}`,
    name:       '随机战斗地图',
    width:      8,
    height:     10,
    terrain:    terrainLayer,
    objects:    objectsLayer,
    deployment: {
      zoneA: { rows: ZONE.deployA, faction: 'player' },
      zoneB: { rows: ZONE.deployB, faction: 'enemy'  },
    },
    victoryConditions,
    defeatConditions: [
      { type: 1, description: '我方全军覆没' },
      { type: 4, turns: 10, description: '超过10回合' },
    ],
    meta,
  };
}
