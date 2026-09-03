/**
 * 战术图玩法对象：巨石 / 陷阱 / 宝箱 / 随机箱 / 农场（mapGenerator_v2 · P5）
 * 须与 terrainGameplayObjects.cjs 同步。
 *
 * 障碍与宝箱候选语义对齐旧 mapGenerator.generateObjects（交战区 + 平原 + 避堵）。
 * 素材：public/assets/san_1_map/tile_3_object/
 *
 * @see docs/01-strategic-world/30-frontend/31-7-MAP_GENERATOR_V2_IMPLEMENTATION.md
 */

import { ZONE } from './tacticalBattleGrid.js';

/** 对象瓦相对 assets/san_1_map/ */
export const GAMEPLAY_OBJECT_DIR = 'tile_3_object';

export const GAMEPLAY_OBJECT_DEFS = Object.freeze({
  rock: Object.freeze({
    isPassable: false,
    isDestructible: false,
    hp: null,
    trapDamage: null,
    tileRel: `${GAMEPLAY_OBJECT_DIR}/rock_01.png`,
  }),
  fence: Object.freeze({
    isPassable: false,
    isDestructible: true,
    hp: 500,
    trapDamage: null,
    tileRel: `${GAMEPLAY_OBJECT_DIR}/fence_01.png`,
  }),
  trap: Object.freeze({
    isPassable: true,
    isDestructible: false,
    hp: null,
    trapDamage: 50,
    tileRel: `${GAMEPLAY_OBJECT_DIR}/trap_01.png`,
  }),
  chest: Object.freeze({
    isPassable: true,
    isDestructible: false,
    hp: null,
    trapDamage: null,
    isInteractable: true,
  }),
  random: Object.freeze({
    isPassable: true,
    isDestructible: false,
    hp: null,
    trapDamage: null,
    isInteractable: true,
    tileRel: `${GAMEPLAY_OBJECT_DIR}/random_01.png`,
  }),
  farm: Object.freeze({
    isPassable: true,
    isDestructible: false,
    hp: null,
    trapDamage: null,
    healOnEnter: 200,
    tileRel: `${GAMEPLAY_OBJECT_DIR}/farm_01.png`,
  }),
});

/** chest_01 → 普通/稀有；chest_02 → 史诗/传奇（不含核心） */
export const CHEST_LOOT_BY_VARIANT = Object.freeze({
  '01': Object.freeze(['common', 'rare']),
  '02': Object.freeze(['epic', 'legendary']),
});

export function chestTileRel(variant, isOpen = false) {
  const v = variant === '02' ? '02' : '01';
  // 开/关暂共用同图（素材无独立 open 帧）
  void isOpen;
  return v === '02'
    ? `${GAMEPLAY_OBJECT_DIR}/chest_02(3-4).png`
    : `${GAMEPLAY_OBJECT_DIR}/chest_01(1-2).png`;
}

/**
 * 按战斗稀有度选宝箱档：低难 01，高难 02。
 * @param {string} battleRarity
 * @returns {'01'|'02'}
 */
export function pickChestVariantForBattleRarity(battleRarity) {
  const r = String(battleRarity || 'common').toLowerCase();
  if (r === 'epic' || r === 'legendary' || r === 'core') return '02';
  return '01';
}

function isPlainGameplayCell(terrain, x, y) {
  return terrain?.[y]?.[x] === 'plain';
}

function cellBlocked(blocked, x, y) {
  return !!(blocked?.[y]?.[x]);
}

function occupiedByObject(positions, x, y) {
  return positions.some((p) => p.x === x && p.y === y);
}

/**
 * 地图中心 30% 格（按距几何中心距离排序取最近 N 格）。
 * @returns {Set<string>} `"x,y"`
 */
export function buildCenterForbiddenKeys(width, height, ratio = 0.3) {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  /** @type {Array<{ x:number, y:number, d:number }>} */
  const cells = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      cells.push({ x, y, d });
    }
  }
  cells.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  const n = Math.max(1, Math.floor(width * height * ratio));
  const set = new Set();
  for (let i = 0; i < n && i < cells.length; i += 1) {
    set.add(`${cells[i].x},${cells[i].y}`);
  }
  return set;
}

/**
 * @param {object} options
 * @param {string[][]} options.terrain  玩法 terrain（已含林/丘/桥）
 * @param {boolean[][]} [options.blocked]  装饰占用（林/丘/桥）
 * @param {{ next:()=>number, int:(max:number)=>number, pick:(arr:any[])=>any, chance?:(p:number)=>boolean }} options.rng
 * @param {string} [options.battleRarity]
 * @param {boolean} [options.skipChest]
 * @param {boolean} [options.skipRandom]
 * @param {boolean} [options.skipFarm]
 * @param {'simple'|'standard'|'complex'} [options.complexity]
 * @returns {{
 *   objects: object[],
 *   meta: { hasChest:boolean, hasRandom:boolean, hasFarm:boolean, obstacleCount:number, chestVariant:string|null }
 * }}
 */
export function placeGameplayObjects(options = {}) {
  const terrain = options.terrain;
  if (!Array.isArray(terrain) || !terrain.length) {
    throw new Error('[terrainGameplayObjects] terrain required');
  }
  const height = terrain.length;
  const width = terrain[0]?.length ?? 0;
  const rng = options.rng;
  if (!rng || typeof rng.next !== 'function' || typeof rng.int !== 'function') {
    throw new Error('[terrainGameplayObjects] rng required');
  }
  const chance = (p) =>
    typeof rng.chance === 'function' ? rng.chance(p) : rng.next() < p;

  const blocked = options.blocked || null;
  const battleRarity = options.battleRarity || 'common';
  const complexity = options.complexity || 'standard';
  const skipChest = options.skipChest === true;
  const skipRandom = options.skipRandom === true;
  const skipFarm = options.skipFarm === true;

  /** @type {object[]} */
  const objects = [];
  /** @type {Array<{x:number,y:number}>} */
  const objectPositions = [];

  const combatRows =
    height === 10 ? ZONE.combat.slice() : [Math.floor(height * 0.3), Math.floor(height * 0.4), Math.floor(height * 0.5), Math.floor(height * 0.6)].filter((y) => y >= 0 && y < height);

  /** 交战区、非贴边列、plain、未装饰占用 */
  /** @type {Array<{x:number,y:number}>} */
  const obstacleCandidates = [];
  for (const y of combatRows) {
    for (let x = 1; x <= width - 2; x += 1) {
      if (!isPlainGameplayCell(terrain, x, y)) continue;
      if (cellBlocked(blocked, x, y)) continue;
      obstacleCandidates.push({ x, y });
    }
  }

  const obstacleRange = { simple: [0, 1], standard: [1, 2], complex: [2, 3] }[complexity] || [1, 2];
  const obstacleCount =
    obstacleRange[0] + rng.int(obstacleRange[1] - obstacleRange[0] + 1);
  const obstacleTypes = ['rock', 'trap']; // 用户指定 tile_3：rock/trap；fence 仍保留定义但本季不抽

  for (let i = 0; i < obstacleCount && obstacleCandidates.length > 0; i += 1) {
    const idx = rng.int(obstacleCandidates.length);
    const { x, y } = obstacleCandidates.splice(idx, 1)[0];
    if (occupiedByObject(objectPositions, x, y)) continue;
    const type = rng.pick(obstacleTypes);
    const def = GAMEPLAY_OBJECT_DEFS[type];
    objects.push({ type, x, y, ...def });
    objectPositions.push({ x, y });
    if (!def.isPassable) {
      for (let di = obstacleCandidates.length - 1; di >= 0; di -= 1) {
        const c = obstacleCandidates[di];
        if (Math.abs(c.y - y) <= 1 && Math.abs(c.x - x) <= 1) {
          obstacleCandidates.splice(di, 1);
        }
      }
    }
  }

  // ── 宝箱（约 20%）──────────────────────────────────────────
  let chestVariant = null;
  if (!skipChest && chance(0.2)) {
    const yMid = [
      Math.floor(height / 2) - 1,
      Math.floor(height / 2),
    ].filter((y) => y >= 0 && y < height);
    /** @type {Array<{x:number,y:number}>} */
    const chestCandidates = [];
    for (const y of yMid) {
      for (let x = 2; x <= width - 3; x += 1) {
        if (!isPlainGameplayCell(terrain, x, y)) continue;
        if (cellBlocked(blocked, x, y)) continue;
        if (occupiedByObject(objectPositions, x, y)) continue;
        chestCandidates.push({ x, y });
      }
    }
    if (chestCandidates.length > 0) {
      const pick = rng.pick(chestCandidates);
      chestVariant = pickChestVariantForBattleRarity(battleRarity);
      const lootRarities = [...CHEST_LOOT_BY_VARIANT[chestVariant]];
      objects.push({
        type: 'chest',
        x: pick.x,
        y: pick.y,
        isOpen: false,
        chestVariant,
        lootRarities,
        rewardRarity: lootRarities[0],
        tileRel: chestTileRel(chestVariant, false),
        ...GAMEPLAY_OBJECT_DEFS.chest,
      });
      objectPositions.push({ x: pick.x, y: pick.y });
    }
  }

  // ── 随机箱（约 20%，与宝箱独立）────────────────────────────
  if (!skipRandom && chance(0.2)) {
    const yMid = [
      Math.floor(height / 2) - 1,
      Math.floor(height / 2),
    ].filter((y) => y >= 0 && y < height);
    /** @type {Array<{x:number,y:number}>} */
    const cand = [];
    for (const y of yMid) {
      for (let x = 2; x <= width - 3; x += 1) {
        if (!isPlainGameplayCell(terrain, x, y)) continue;
        if (cellBlocked(blocked, x, y)) continue;
        if (occupiedByObject(objectPositions, x, y)) continue;
        cand.push({ x, y });
      }
    }
    if (cand.length > 0) {
      const pick = rng.pick(cand);
      objects.push({
        type: 'random',
        x: pick.x,
        y: pick.y,
        isOpen: false,
        ...GAMEPLAY_OBJECT_DEFS.random,
      });
      objectPositions.push({ x: pick.x, y: pick.y });
    }
  }

  // ── 农场：上下各 1，避开中心 30% ───────────────────────────
  if (!skipFarm) {
    const centerKeys = buildCenterForbiddenKeys(width, height, 0.3);
    const midY = height / 2;
    /** @type {Array<{x:number,y:number}>} */
    const upper = [];
    /** @type {Array<{x:number,y:number}>} */
    const lower = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (centerKeys.has(`${x},${y}`)) continue;
        if (!isPlainGameplayCell(terrain, x, y)) continue;
        if (cellBlocked(blocked, x, y)) continue;
        if (occupiedByObject(objectPositions, x, y)) continue;
        if (y < midY) upper.push({ x, y });
        else lower.push({ x, y });
      }
    }
    for (const pool of [upper, lower]) {
      if (pool.length === 0) continue;
      const pick = rng.pick(pool);
      objects.push({
        type: 'farm',
        x: pick.x,
        y: pick.y,
        isOpen: false,
        ...GAMEPLAY_OBJECT_DEFS.farm,
      });
      objectPositions.push({ x: pick.x, y: pick.y });
    }
  }

  return {
    objects,
    meta: {
      hasChest: objects.some((o) => o.type === 'chest'),
      hasRandom: objects.some((o) => o.type === 'random'),
      hasFarm: objects.some((o) => o.type === 'farm'),
      obstacleCount: objects.filter((o) => o.type === 'rock' || o.type === 'trap' || o.type === 'fence')
        .length,
      chestVariant,
    },
  };
}
