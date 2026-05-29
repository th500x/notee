/**
 * 小型战斗地图自动生成器
 *
 * 生成战术格网尺寸见 `tacticalBattleGrid.js`，包含：
 *   - Terrain 层：基础底色 + 叠加地形（树林/丘陵）
 *   - Objects 层：巨石、栅栏、陷阱、宝箱
 *
 * 素材路径：assets/san_1_map/
 *   tile_1_bg/       — plain_grassland_01~05, plain_wasteland_01~05, *_chest
 *   tile_2_terrain/  — forest_01~05, hill_01~05
 *   tile_3_object/   — rock_01, fence_01, trap_01, chest_01_cl, chest_01_op
 *
 * 用法：
 *   import { generateSmallMap } from '@shared/utils/mapGenerator';
 *   const result = generateSmallMap({ seed: 12345 });
 *
 * @see docs/30-frontend/31-1-MAP_GENERATION.md
 *
 * 资源文件名与 public/assets/san_1_map 一致（§1.3）；不含战役 CSV 的 forces/siege 等（见 91-3）。
 */

import {
  TACTICAL_GRID_WIDTH as MAP_WIDTH,
  TACTICAL_GRID_HEIGHT as MAP_HEIGHT,
  ZONE,
} from './tacticalBattleGrid.js';

// ── 常量 ──────────────────────────────────────────────────────────────────────

// 地形类型
const TERRAIN = {
  PLAIN:  'plain',   // 基础底色（绿地或荒地，由 bgTheme 决定）
  FOREST: 'forest',
  HILL:   'hill',
  WASTE:  'waste',   // 荒地作为交战区点缀（视觉变化，无特殊效果）
};

// 地形权重（交战区）
const COMBAT_TERRAIN_WEIGHTS = [
  { type: TERRAIN.FOREST, weight: 40 },
  { type: TERRAIN.HILL,   weight: 35 },
  { type: TERRAIN.WASTE,  weight: 25 },
];

// 部署区只用树林和丘陵
const DEPLOY_TERRAIN_WEIGHTS = [
  { type: TERRAIN.FOREST, weight: 50 },
  { type: TERRAIN.HILL,   weight: 50 },
];

// 簇大小权重
const CLUSTER_SIZE_WEIGHTS = [
  { size: 2, weight: 40 },
  { size: 3, weight: 35 },
  { size: 4, weight: 25 },
];

// 簇形状模板 [dy, dx] 相对于起始点的偏移
const CLUSTER_SHAPES = {
  2: [
    [[0,0],[0,1]],           // 横排
    [[0,0],[1,0]],           // 竖排
    [[0,0],[1,1]],           // 斜向↘
    [[0,1],[1,0]],           // 斜向↙
  ],
  3: [
    [[0,0],[0,1],[0,2]],     // 横排
    [[0,0],[1,0],[2,0]],     // 竖排
    [[0,0],[1,1],[2,2]],     // 斜向↘
    [[0,2],[1,1],[2,0]],     // 斜向↙
    [[0,0],[0,1],[1,0]],     // L形
    [[0,0],[0,1],[1,1]],     // L形（镜像）
    [[0,0],[1,0],[1,1]],     // 阶梯↘
    [[0,1],[1,0],[1,1]],     // 阶梯↙（修正）
  ],
  4: [
    [[0,0],[0,1],[1,0],[1,1]],       // 田字
    [[0,0],[0,1],[0,2],[0,3]],       // 横排
    [[0,0],[1,0],[2,0],[3,0]],       // 竖排
    [[0,0],[0,1],[0,2],[1,2]],       // L形大
    [[0,0],[1,0],[1,1],[1,2]],       // L形大（镜像）
    [[0,0],[0,1],[1,1],[1,2]],       // Z形
    [[0,1],[0,2],[1,0],[1,1]],       // S形
    [[0,0],[1,1],[2,2],[3,3]],       // 长斜向↘
  ],
};

// 对象类型定义
const OBJECT_TYPES = {
  rock:  { isPassable: false, isDestructible: false, hp: null,  trapDamage: null },
  fence: { isPassable: false, isDestructible: true,  hp: 500,   trapDamage: null },
  trap:  { isPassable: true,  isDestructible: false, hp: null,  trapDamage: 50   },
  chest: { isPassable: true,  isDestructible: false, hp: null,  trapDamage: null, isInteractable: true },
};

// ── 伪随机数生成器（支持种子，保证可复现） ────────────────────────────────────

class SeededRandom {
  constructor(seed) {
    this.seed = seed != null ? seed : Math.floor(Math.random() * 2147483647);
    this._state = this.seed;
  }

  /** 返回 [0, 1) 的浮点数 */
  next() {
    this._state = (this._state * 1664525 + 1013904223) & 0xffffffff;
    return (this._state >>> 0) / 0x100000000;
  }

  /** 返回 [min, max] 的整数 */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** 按权重随机选择 */
  weighted(items) {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = this.next() * total;
    for (const item of items) {
      r -= item.weight;
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  }

  /** 从数组随机选一个 */
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** 返回 true 的概率为 p（0~1） */
  chance(p) {
    return this.next() < p;
  }
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/** 检查坐标是否在地图范围内 */
function inBounds(y, x) {
  return y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH;
}

/** 将簇形状模板应用到起始点，返回所有格子坐标 */
function applyShape(shape, startY, startX) {
  return shape.map(([dy, dx]) => [startY + dy, startX + dx]);
}

/** 检查一组格子是否全部在指定行范围内且在地图内 */
function cellsInRows(cells, rows) {
  return cells.every(([y, x]) => inBounds(y, x) && rows.includes(y));
}

/** 检查两组格子是否有重叠或间距不足（间距 < gap） */
function hasConflict(newCells, existingCells, gap = 1) {
  for (const [ny, nx] of newCells) {
    for (const [ey, ex] of existingCells) {
      if (Math.abs(ny - ey) <= gap && Math.abs(nx - ex) <= gap) return true;
    }
  }
  return false;
}

/** 按权重决定地图复杂度 */
function pickComplexity(rng) {
  const r = rng.next();
  if (r < 0.40) return 'simple';
  if (r < 0.80) return 'standard';
  return 'complex';
}

// ── 核心生成函数 ──────────────────────────────────────────────────────────────

/**
 * 生成地形簇
 * @param {SeededRandom} rng
 * @param {number[]} allowedRows  - 允许放置的行
 * @param {number[]} allowedCols  - 允许放置的列（起始点）
 * @param {number} maxSize        - 最大簇大小
 * @param {Array}  terrainWeights - 地形权重列表
 * @param {Array}  occupiedCells  - 已占用格子（用于冲突检测）
 * @param {number} maxRetries
 * @returns {{ type, cells }|null}
 */
function generateCluster(rng, allowedRows, allowedCols, maxSize, terrainWeights, occupiedCells, maxRetries = 15) {
  const sizeWeights = CLUSTER_SIZE_WEIGHTS.filter(s => s.size <= maxSize);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const size    = rng.weighted(sizeWeights).size;
    const shapes  = CLUSTER_SHAPES[size];
    const shape   = rng.pick(shapes);
    const startY  = rng.pick(allowedRows);
    const startX  = rng.pick(allowedCols);
    const cells   = applyShape(shape, startY, startX);

    // 所有格子必须在允许的行内
    if (!cellsInRows(cells, allowedRows)) continue;
    // 不与已有格子冲突（间距至少1格）
    if (hasConflict(cells, occupiedCells, 1)) continue;

    const type = rng.weighted(terrainWeights).type;
    return { type, cells };
  }
  return null;
}

/**
 * 生成 Terrain 层
 */
function generateTerrain(rng, complexity) {
  // 初始化：全部填充 plain
  const grid = Array.from({ length: MAP_HEIGHT }, () =>
    Array(MAP_WIDTH).fill(TERRAIN.PLAIN)
  );

  const occupiedCells = []; // 所有已放置非平原格子

  // 交战区簇数量
  const combatClusterCount = { simple: 3, standard: 4, complex: 5 }[complexity];
  const allCombatCols = [0,1,2,3,4,5,6,7];

  for (let i = 0; i < combatClusterCount; i++) {
    const cluster = generateCluster(
      rng, ZONE.combat, allCombatCols, 4,
      COMBAT_TERRAIN_WEIGHTS, occupiedCells
    );
    if (!cluster) continue;
    for (const [y, x] of cluster.cells) {
      grid[y][x] = cluster.type;
      occupiedCells.push([y, x]);
    }
  }

  // 部署区簇数量
  const deployClusterCount = { simple: 1, standard: 2, complex: 3 }[complexity];
  const edgeCols = [0, 1, 6, 7];

  // 部署区A
  const occupiedA = [];
  for (let i = 0; i < deployClusterCount; i++) {
    const cluster = generateCluster(
      rng, ZONE.deployA, edgeCols, 3,
      DEPLOY_TERRAIN_WEIGHTS, [...occupiedCells, ...occupiedA]
    );
    if (!cluster) continue;
    for (const [y, x] of cluster.cells) {
      grid[y][x] = cluster.type;
      occupiedA.push([y, x]);
    }
  }

  // 部署区B（独立随机，与A区相同簇数）
  const occupiedB = [];
  for (let i = 0; i < deployClusterCount; i++) {
    const cluster = generateCluster(
      rng, ZONE.deployB, edgeCols, 3,
      DEPLOY_TERRAIN_WEIGHTS, [...occupiedCells, ...occupiedB]
    );
    if (!cluster) continue;
    for (const [y, x] of cluster.cells) {
      grid[y][x] = cluster.type;
      occupiedB.push([y, x]);
    }
  }

  return { grid, occupiedCells };
}

/**
 * 生成 Objects 层
 */
function generateObjects(rng, grid, occupiedCells, complexity, battleRarity) {
  const objects = [];
  const objectPositions = []; // 已放置对象的坐标

  // 障碍物数量范围
  const obstacleRange = { simple: [0,1], standard: [1,2], complex: [2,3] }[complexity];
  const obstacleCount = rng.int(obstacleRange[0], obstacleRange[1]);

  // 可放置障碍物的格子：交战区、平原、非边缘列（1-6）
  const candidateCells = [];
  for (const y of ZONE.combat) {
    for (let x = 1; x <= 6; x++) {
      if (grid[y][x] === TERRAIN.PLAIN) {
        candidateCells.push([y, x]);
      }
    }
  }

  // 放置障碍物（巨石/栅栏/陷阱各约1/3）
  const obstacleTypes = ['rock', 'fence', 'trap'];
  for (let i = 0; i < obstacleCount && candidateCells.length > 0; i++) {
    // 随机选一个候选格子
    const idx  = rng.int(0, candidateCells.length - 1);
    const [y, x] = candidateCells.splice(idx, 1)[0];

    // 检查与已有对象不重叠
    if (objectPositions.some(([oy, ox]) => oy === y && ox === x)) continue;

    const type = rng.pick(obstacleTypes);
    const obj  = { type, x, y, ...OBJECT_TYPES[type] };
    objects.push(obj);
    objectPositions.push([y, x]);

    // 巨石和栅栏不可通行，从候选格子中移除周围格子（避免堵死通道）
    if (!OBJECT_TYPES[type].isPassable) {
      // 移除相邻格子，防止连续不可通行格堵死路径
      for (let di = candidateCells.length - 1; di >= 0; di--) {
        const [cy, cx] = candidateCells[di];
        if (Math.abs(cy - y) <= 1 && Math.abs(cx - x) <= 1) {
          candidateCells.splice(di, 1);
        }
      }
    }
  }

  // 宝箱（20%概率，放在交战区中央）
  if (rng.chance(0.20)) {
    const chestCandidates = [];
    for (const y of [4, 5]) {
      for (let x = 2; x <= 5; x++) {
        if (
          grid[y][x] === TERRAIN.PLAIN &&
          !objectPositions.some(([oy, ox]) => oy === y && ox === x)
        ) {
          chestCandidates.push([y, x]);
        }
      }
    }
    if (chestCandidates.length > 0) {
      const [cy, cx] = rng.pick(chestCandidates);
      objects.push({
        type:          'chest',
        x:             cx,
        y:             cy,
        isOpen:        false,
        rewardRarity:  battleRarity || 'common', // 奖励等级与战斗稀有度相同
        ...OBJECT_TYPES.chest,
      });
    }
  }

  return objects;
}

// ── 主入口 ────────────────────────────────────────────────────────────────────

/**
 * 生成小型战术地图（尺寸见 tacticalBattleGrid）
 *
 * @param {object} options
 * @param {number|null} options.seed          - 随机种子（null = 随机，可用于复现地图）
 * @param {string}      options.battleRarity  - 战斗稀有度（影响宝箱奖励）
 * @param {string|null} options.bgTheme       - 底色主题 'grassland'|'wasteland'|null（null=随机）
 * @returns {MapGenerationResult}
 */
export function generateSmallMap({
  seed         = null,
  battleRarity = 'common',
  bgTheme      = null,
} = {}) {
  const rng = new SeededRandom(seed);

  // ── 1. 战斗级别变体选择 ──────────────────────────────────────────────────
  const theme      = bgTheme || (rng.chance(0.5) ? 'grassland' : 'wasteland');
  const bgVariant  = rng.int(1, 5);   // 底色变体 1-5
  const fVariant   = rng.int(1, 5);   // 树林变体
  const hVariant   = rng.int(1, 5);   // 丘陵变体

  const variants = {
    bgTheme:   theme,
    bgVariant: String(bgVariant).padStart(2, '0'),
    forest:    String(fVariant).padStart(2, '0'),
    hill:      String(hVariant).padStart(2, '0'),
  };

  // ── 2. 地图复杂度 ────────────────────────────────────────────────────────
  const complexity = pickComplexity(rng);

  // ── 3. Terrain 层 ────────────────────────────────────────────────────────
  const { grid, occupiedCells } = generateTerrain(rng, complexity);

  // ── 4. Objects 层 ────────────────────────────────────────────────────────
  const objects = generateObjects(rng, grid, occupiedCells, complexity, battleRarity);

  // ── 5. 统计元数据 ────────────────────────────────────────────────────────
  let combatNonPlain = 0;
  for (const y of ZONE.combat) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (grid[y][x] !== TERRAIN.PLAIN) combatNonPlain++;
    }
  }

  const cellFire = Array.from({ length: MAP_HEIGHT }, () =>
    Array.from({ length: MAP_WIDTH }, () => false),
  );

  return {
    // 地形二维数组 [y][x]，值为 TERRAIN 常量
    terrain: grid,

    // 变体信息（用于拼接图片路径）
    variants,

    // 对象列表
    objects,

    // 着火格 [y][x]（事件/随机图当前恒为 false；与战役 mapResult 字段对齐）
    cellFire,

    // 元数据
    meta: {
      seed:                    rng.seed,
      complexity,
      bgTheme:                 theme,
      combatNonPlain,
      combatNonPlainRatio:     +(combatNonPlain / (ZONE.combat.length * MAP_WIDTH)).toFixed(2),
      hasChest:                objects.some(o => o.type === 'chest'),
      obstacleCount:           objects.filter(o => o.type !== 'chest').length,
    },
  };
}

// ── 图片路径解析工具 ──────────────────────────────────────────────────────────

const TILE_BASE = 'assets/san_1_map/';

/**
 * 根据格子地形类型和变体信息，返回该格子需要渲染的图片路径列表
 * （底色层 + 叠加层，按顺序渲染）
 *
 * @param {string} terrainType  - TERRAIN 常量
 * @param {object} variants     - generateSmallMap 返回的 variants
 * @param {boolean} isChestCell - 是否是宝箱格子（使用专用底板）
 * @returns {string[]}          - 图片路径数组（从底到顶）
 */
export function getTileLayers(terrainType, variants, isChestCell = false) {
  const { bgTheme, bgVariant, forest, hill } = variants;
  const bgPrefix = bgTheme === 'wasteland' ? 'plain_wasteland' : 'plain_grassland';

  // 底色层
  const bgFile = isChestCell
    ? `${bgPrefix}_chest.png`
    : `${bgPrefix}_${bgVariant}.png`;
  const layers = [`${TILE_BASE}tile_1_bg/${bgFile}`];

  // 叠加层（树林/丘陵）
  if (terrainType === TERRAIN.FOREST) {
    layers.push(`${TILE_BASE}tile_2_terrain/forest_${forest}.png`);
  } else if (terrainType === TERRAIN.HILL) {
    layers.push(`${TILE_BASE}tile_2_terrain/hill_${hill}.png`);
  }
  // WASTE 和 PLAIN 只有底色层（荒地通过 bgTheme='wasteland' 体现，或作为交战区点缀时视觉上与底色相同）

  return layers;
}

/**
 * 根据对象类型返回图片路径
 *
 * @param {string}  objectType - 'rock'|'fence'|'trap'|'chest'
 * @param {boolean} isOpen     - 宝箱是否已开启
 * @returns {string}
 */
export function getObjectImage(objectType, isOpen = false) {
  const map = {
    rock:  'tile_3_object/rock_01.png',
    fence: 'tile_3_object/fence_01.png',
    trap:  'tile_3_object/trap_01.png',
    chest: isOpen ? 'tile_3_object/chest_01_op.png' : 'tile_3_object/chest_01_cl.png',
  };
  return `${TILE_BASE}${map[objectType] || ''}`;
}

// ── 导出常量（供其他模块使用） ────────────────────────────────────────────────

export { TERRAIN, ZONE, OBJECT_TYPES, MAP_WIDTH, MAP_HEIGHT };
