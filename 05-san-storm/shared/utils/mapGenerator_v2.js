/**
 * 战术底图生成器 v2（Shape + Wang + 树林/山丘对象瓦）
 * 须与 mapGenerator_v2.cjs 同步。
 *
 * 尺寸由调用方传入；小型图默认 8×10（见 generateSmallMapV2）。
 * 玩法对象属性表见 `terrainGameplayObjects.GAMEPLAY_OBJECT_DEFS`。
 *
 * @see docs/01-strategic-world/30-frontend/31-7-MAP_GENERATOR_V2_IMPLEMENTATION.md
 */

import {
  TACTICAL_GRID_WIDTH,
  TACTICAL_GRID_HEIGHT,
} from './tacticalBattleGrid.js';
import {
  createTerrainShapeRng,
  generateTerrainOccupancy,
  TERRAIN_OCC,
} from './terrainShape.js';
import { resolveWangBaseTileGrid } from './terrainWangResolve.js';
import {
  placeTerrainObjects,
  buildGameplayTerrainFromOccupancy,
  FOREST_VARIANT_DEFS,
  HILL_VARIANT_IDS,
  hillTileRel,
} from './terrainObjectPlace.js';
import { placeGameplayObjects } from './terrainGameplayObjects.js';

/**
 * @param {object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {number|null} [options.seed]
 * @param {'void'|'grass'} [options.base]
 * @param {object} [options.river]  透传 terrainShape
 * @param {object} [options.grass]
 * @param {object} [options.lava]
 * @param {{ x:number,y:number,w:number,h:number }[]} [options.reservedRects]
 * @param {object|false} [options.forest]  false=关闭；否则透传 placeTerrainObjects
 * @param {object|false} [options.hill]
 * @param {object|false} [options.bridge]
 * @param {object|false} [options.gameplayObjects] false=关闭 rock/trap/chest/random/farm
 * @param {string} [options.battleRarity]
 * @param {boolean} [options.skipChest]
 * @param {boolean} [options.skipRandom]
 * @param {boolean} [options.skipFarm]
 * @param {'simple'|'standard'|'complex'} [options.complexity]
 * @returns {object} 与小型图 mapResult 兼容并扩展
 */
export function generateMapV2(options = {}) {
  const width = Math.floor(Number(options.width));
  const height = Math.floor(Number(options.height));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) {
    throw new Error(`[mapGenerator_v2] invalid size ${options.width}×${options.height}`);
  }

  const seedRaw = options.seed;
  const seed =
    seedRaw != null && Number.isFinite(Number(seedRaw))
      ? Number(seedRaw)
      : Math.floor(Math.random() * 2147483646) + 1;

  const shape = generateTerrainOccupancy({
    width,
    height,
    seed,
    base: options.base ?? TERRAIN_OCC.GRASS,
    river: options.river,
    grass: options.grass,
    lava: options.lava,
    reservedRects: options.reservedRects,
  });

  // 深拷贝占格：Wang 会在邻格画出河岸表意，需把这些格补成真实 water/lava，
  // 使玩法河宽与画面一致；底瓦仍用补齐前的选瓦，保留对称美观的河面。
  /** @type {string[][]} */
  const occupancy = shape.occupancy.map((row) => row.slice());
  const wang = resolveWangBaseTileGrid(occupancy);

  let wangExpandedWater = 0;
  let wangExpandedLava = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const kind = wang.kinds[y][x];
      if (kind === TERRAIN_OCC.WATER && occupancy[y][x] !== TERRAIN_OCC.WATER) {
        occupancy[y][x] = TERRAIN_OCC.WATER;
        wangExpandedWater += 1;
      } else if (kind === TERRAIN_OCC.LAVA && occupancy[y][x] !== TERRAIN_OCC.LAVA) {
        occupancy[y][x] = TERRAIN_OCC.LAVA;
        wangExpandedLava += 1;
      }
    }
  }

  // 对象瓦用独立 LCG 流，避免与 Shape 内部消费互相牵制；由 seed 派生
  const overlayRng = createTerrainShapeRng((seed * 1103515245 + 12345) >>> 0 || 1);
  const forestOpt = options.forest === false ? { enabled: false } : { enabled: true, ...(options.forest || {}) };
  const hillOpt = options.hill === false ? { enabled: false } : { enabled: true, ...(options.hill || {}) };
  const bridgeOpt = options.bridge === false ? false : { enabled: true, ...(options.bridge || {}) };
  const placed = placeTerrainObjects({
    occupancy,
    rng: overlayRng,
    forest: forestOpt,
    hill: hillOpt,
    bridge: bridgeOpt,
  });

  const terrain = buildGameplayTerrainFromOccupancy(occupancy, placed);

  const gameplayRng = createTerrainShapeRng((seed * 2654435761 + 97) >>> 0 || 1);
  const gameplayOpt = options.gameplayObjects;
  const gameplay =
    gameplayOpt === false
      ? {
          objects: [],
          meta: {
            hasChest: false,
            hasRandom: false,
            hasFarm: false,
            obstacleCount: 0,
            chestVariant: null,
          },
        }
      : placeGameplayObjects({
          terrain,
          blocked: placed.blocked,
          rng: gameplayRng,
          battleRarity: options.battleRarity || 'common',
          skipChest: options.skipChest === true || gameplayOpt?.skipChest === true,
          skipRandom: options.skipRandom === true || gameplayOpt?.skipRandom === true,
          skipFarm: options.skipFarm === true || gameplayOpt?.skipFarm === true,
          complexity: options.complexity || gameplayOpt?.complexity || 'standard',
        });

  let combatNonPlain = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (terrain[y][x] !== 'plain') combatNonPlain += 1;
    }
  }

  const cellFire = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => false),
  );

  const variants = {
    bgTheme: 'grassland',
    bgVariant: 'wang',
    forest: 'mixed',
    hill: 'mixed',
    generator: 'v2',
  };

  return {
    width,
    height,
    terrain,
    occupancy,
    baseTileRel: wang.tileRel,
    wangMasks: wang.masks,
    wangKinds: wang.kinds,
    terrainOverlays: {
      forests: placed.forests,
      hills: placed.hills,
      bridge: placed.bridge,
      bridges: placed.bridges || (placed.bridge ? [placed.bridge] : []),
    },
    variants,
    objects: gameplay.objects,
    cellFire,
    meta: {
      seed: shape.seed,
      generator: 'v2',
      width,
      height,
      bgTheme: 'grassland',
      complexity: options.complexity || 'standard',
      combatNonPlain,
      combatNonPlainRatio: +(combatNonPlain / (width * height)).toFixed(2),
      hasChest: gameplay.meta.hasChest,
      hasRandom: gameplay.meta.hasRandom,
      hasFarm: gameplay.meta.hasFarm,
      chestVariant: gameplay.meta.chestVariant,
      obstacleCount: gameplay.meta.obstacleCount,
      forestStampCount: placed.forests.length,
      hillCellCount: placed.hills.length,
      hasBridge: !!(placed.bridges?.length || placed.bridge),
      bridgeCount: placed.bridges?.length || (placed.bridge ? 1 : 0),
      bridgeOrient: placed.bridge?.orient ?? null,
      wangExpandedWater,
      wangExpandedLava,
      shape: shape.meta,
    },
  };
}

/**
 * 小型战术图入口（默认 8×10），替代 generateSmallMap。
 * @param {object} [options]
 * @param {number|null} [options.seed]
 * @param {string} [options.battleRarity]  仅写入 meta，对象层 P5 再消费
 * @param {boolean} [options.skipRiver]
 * @param {boolean} [options.withLava]
 * @param {boolean} [options.skipChest]
 * @param {boolean} [options.skipRandom]
 * @param {boolean} [options.skipFarm]
 */
export function generateSmallMapV2({
  seed = null,
  battleRarity = 'common',
  skipRiver = false,
  withLava = false,
  skipChest = false,
  skipRandom = false,
  skipFarm = false,
} = {}) {
  const width = TACTICAL_GRID_WIDTH;
  const height = TACTICAL_GRID_HEIGHT;
  const seedNum =
    seed != null && Number.isFinite(Number(seed))
      ? Number(seed)
      : Math.floor(Math.random() * 2147483646) + 1;

  // 用派生 rng 决定是否画河，保证同种子可复现
  const decideRng = createTerrainShapeRng(seedNum);
  const riverEnabled = !skipRiver && decideRng.next() < 0.62;
  // 直河 ns/ew、蜿蜒 meander（固定表意河宽 2）、偶发 L
  const stylePool = ['ns', 'ew', 'meander', 'meander', 'L'];
  const riverStyle = stylePool[decideRng.int(stylePool.length)];
  const thickness =
    riverStyle === 'meander' ? 1 : decideRng.next() < 0.45 ? 1 : 2;

  const result = generateMapV2({
    width,
    height,
    seed: seedNum,
    base: TERRAIN_OCC.GRASS,
    river: riverEnabled
      ? { enabled: true, style: riverStyle, thickness }
      : { enabled: false },
    lava: withLava
      ? { enabled: true, region: 'south', coverage: 0.08 }
      : { enabled: false },
    forest: { enabled: true },
    hill: { enabled: true, stampsPerCellMin: 2, stampsPerCellMax: 3 },
    bridge: { enabled: true },
    battleRarity,
    skipChest,
    skipRandom,
    skipFarm,
    complexity: 'standard',
  });

  result.meta.battleRarity = battleRarity;
  result.meta.riverEnabled = riverEnabled;
  if (riverEnabled) {
    result.meta.riverStyle = riverStyle;
    result.meta.riverThickness = thickness;
  }
  return result;
}

/**
 * 在规则层改写 `terrain` 之后，按玩法格网重算 Wang 底瓦与林/丘叠层（不改 terrain 语义）。
 * 用于 PvP：`generateSmallMapV2` → `applyPvpDuelRules` → 本函数。
 * **不**把 Wang 岸线渗水写回 terrain（避免冲掉旱路列等规则格）。
 *
 * @param {object} mapResult
 * @param {{ seed?: number|null }} [opts]
 * @returns {object} 同一 mapResult（原地修改）
 */
export function syncMapResultVisualsFromTerrain(mapResult, opts = {}) {
  const terrain = mapResult?.terrain;
  if (!Array.isArray(terrain) || !terrain.length || !terrain[0]?.length) {
    return mapResult;
  }
  const height = terrain.length;
  const width = terrain[0].length;
  const seedRaw = opts.seed ?? mapResult.meta?.seed ?? 1;
  const rng = createTerrainShapeRng((Number(seedRaw) ^ 0x57414e47) >>> 0 || 1);

  /** @type {string[][]} */
  const occupancy = [];
  for (let y = 0; y < height; y += 1) {
    occupancy[y] = [];
    for (let x = 0; x < width; x += 1) {
      const t = terrain[y][x];
      if (t === 'river' || t === 'lake' || t === 'bridge') occupancy[y][x] = TERRAIN_OCC.WATER;
      else if (t === 'lava') occupancy[y][x] = TERRAIN_OCC.LAVA;
      else occupancy[y][x] = TERRAIN_OCC.GRASS;
    }
  }

  const wang = resolveWangBaseTileGrid(occupancy);
  mapResult.occupancy = occupancy;
  mapResult.baseTileRel = wang.tileRel;
  mapResult.wangMasks = wang.masks;
  mapResult.wangKinds = wang.kinds;

  const claimed = new Set();
  /** @type {Array<{ type: string, x: number, y: number, spanW: number, spanH: number, variant: string, tileRel: string }>} */
  const forests = [];
  const tryStamp = (x, y, def) => {
    for (let dy = 0; dy < def.spanH; dy += 1) {
      for (let dx = 0; dx < def.spanW; dx += 1) {
        const cx = x + dx;
        const cy = y + dy;
        if (cy >= height || cx >= width) return false;
        if (terrain[cy][cx] !== 'forest') return false;
        if (claimed.has(`${cy},${cx}`)) return false;
      }
    }
    for (let dy = 0; dy < def.spanH; dy += 1) {
      for (let dx = 0; dx < def.spanW; dx += 1) {
        claimed.add(`${y + dy},${x + dx}`);
      }
    }
    forests.push({
      type: 'forest',
      x,
      y,
      spanW: def.spanW,
      spanH: def.spanH,
      variant: def.id,
      tileRel: def.tileRel,
    });
    return true;
  };
  const forestDefsH = FOREST_VARIANT_DEFS.filter((d) => d.spanW === 2 && d.spanH === 1);
  const forestDefsV = FOREST_VARIANT_DEFS.filter((d) => d.spanW === 1 && d.spanH === 2);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (terrain[y][x] !== 'forest' || claimed.has(`${y},${x}`)) continue;
      const hDef = forestDefsH[0];
      const vDef = forestDefsV[0];
      if (hDef && tryStamp(x, y, hDef)) continue;
      if (vDef && tryStamp(x, y, vDef)) continue;
    }
  }

  /** @type {Array<{ type: string, x: number, y: number, stamps: Array<{ variant: string, ox: number, oy: number, tileRel: string }> }>} */
  const hills = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (terrain[y][x] !== 'hill') continue;
      const stampCount = 2 + rng.int(2);
      /** @type {Array<{ variant: string, ox: number, oy: number, tileRel: string }>} */
      const stamps = [];
      for (let s = 0; s < stampCount; s += 1) {
        const variant = rng.pick([...HILL_VARIANT_IDS]);
        stamps.push({
          variant,
          ox: rng.next() * 0.5,
          oy: rng.next() * 0.5,
          tileRel: hillTileRel(variant),
        });
      }
      hills.push({ type: 'hill', x, y, stamps });
    }
  }

  mapResult.terrainOverlays = {
    forests,
    hills,
    bridge: null,
    bridges: [],
  };
  if (!mapResult.variants) mapResult.variants = {};
  mapResult.variants.generator = 'v2';
  mapResult.variants.bgVariant = 'wang';
  mapResult.meta = {
    ...mapResult.meta,
    visualsSyncedFromTerrain: true,
    forestStampCount: forests.length,
    hillCellCount: hills.length,
    hasBridge: false,
    bridgeCount: 0,
  };
  return mapResult;
}

export { TERRAIN_OCC };
