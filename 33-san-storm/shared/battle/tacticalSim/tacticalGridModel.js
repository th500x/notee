/**
 * headless 战术格网模型（无 React / DOM）：可通行、移动消耗、Dijkstra 寻路。
 *
 * 移动消耗语义与前端 `battleFlowManager.getMoveCost` **逐条对齐**（单一来源约束）：
 *   - river / lake → 不可通行（Infinity）
 *   - rock / fence 等 `isPassable === false` 的对象 → 不可通行
 *   - forest / hill → 进入消耗 2（其余地形 1）
 *   - 着火格 `cellFire` → 额外 +2（对决图禁 trap，通常无火；保留以保证语义同源）
 *
 * @see game/src/systems/battleFlowManager.js getMoveCost
 */

import { getMapTerrainDimensions } from '../../utils/tacticalBattleGrid.js';

const IMPASSABLE_TERRAIN = new Set(['river', 'lake']);
const TERRAIN_EXTRA_MOVE = { forest: 1, hill: 1 };

/** @returns {Map<string,object>} key `y,x` → object（含 isPassable） */
export function buildObjectMap(mapResult) {
  const m = new Map();
  for (const o of mapResult.objects || []) m.set(`${o.y},${o.x}`, o);
  return m;
}

/** 进入 (y,x) 的移动消耗；不可通行返回 Infinity（与 battleFlowManager.getMoveCost 同语义） */
export function getMoveCost(y, x, mapResult, objMap) {
  if (!mapResult) return 1;
  const t = mapResult.terrain?.[y]?.[x];
  if (t == null) return Infinity;
  if (IMPASSABLE_TERRAIN.has(t)) return Infinity;
  const obj = objMap ? objMap.get(`${y},${x}`) : (mapResult.objects || []).find((o) => o.y === y && o.x === x);
  if (obj && obj.isPassable === false) return Infinity;
  let cost = 1 + (TERRAIN_EXTRA_MOVE[t] || 0);
  if (mapResult.cellFire?.[y]?.[x]) cost += 2;
  return cost;
}

export function isPassableCell(y, x, mapResult, objMap) {
  return getMoveCost(y, x, mapResult, objMap) !== Infinity;
}

export function gridDist(a, b) {
  return Math.abs(a.y - b.y) + Math.abs(a.x - b.x);
}

export function troopAttackRange(troop) {
  const r = Number(troop?.range);
  return Number.isFinite(r) && r > 0 ? r : 1;
}

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Dijkstra：从 start 到「任一 goal 集合」的最短移动消耗路径（含目标格本身）。
 * 进入消耗用 getMoveCost；起点不计消耗。被占用格（blocked）不可进入，但允许作为 goal。
 *
 * @returns {{ path: Array<[y,x]>, cost: number } | null}
 */
export function dijkstraPath(start, goalSet, mapResult, objMap, blocked) {
  const { w, h } = getMapTerrainDimensions(mapResult);
  const key = (y, x) => `${y},${x}`;
  const startKey = key(start.y, start.x);

  const dist = new Map([[startKey, 0]]);
  const prev = new Map();
  /** 简单优先队列（格子数小，线性取最小即可，确定性好） */
  const frontier = new Set([startKey]);

  let foundGoal = null;

  while (frontier.size > 0) {
    let curKey = null;
    let curDist = Infinity;
    for (const k of frontier) {
      const d = dist.get(k);
      if (d < curDist) {
        curDist = d;
        curKey = k;
      }
    }
    frontier.delete(curKey);
    const [cy, cx] = curKey.split(',').map(Number);

    if (goalSet.has(curKey)) {
      foundGoal = curKey;
      break;
    }

    for (const [dy, dx] of DIRS) {
      const ny = cy + dy;
      const nx = cx + dx;
      if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
      const nKey = key(ny, nx);
      const isGoal = goalSet.has(nKey);
      // 目标格允许进入（用于贴近敌人/落点）；其它被占用格不可进入
      if (!isGoal && blocked && blocked.has(nKey)) continue;
      const stepCost = getMoveCost(ny, nx, mapResult, objMap);
      if (stepCost === Infinity) continue;
      const nd = curDist + stepCost;
      if (nd < (dist.get(nKey) ?? Infinity)) {
        dist.set(nKey, nd);
        prev.set(nKey, curKey);
        frontier.add(nKey);
      }
    }
  }

  if (!foundGoal) return null;

  const path = [];
  let k = foundGoal;
  while (k && k !== startKey) {
    const [py, px] = k.split(',').map(Number);
    path.unshift([py, px]);
    k = prev.get(k);
  }
  return { path, cost: dist.get(foundGoal) };
}

/**
 * 在 movement 预算内，沿最短路朝最近敌人移动；返回新坐标（不进入被占用的非目标格）。
 * 目标 = 任一敌人「攻击范围内的空格」；若已在范围内则不动。
 *
 * @returns {{ y, x, steps: Array<[y,x]> }}
 */
export function stepToward(unit, enemies, mapResult, objMap, occupied) {
  const range = troopAttackRange(unit);
  // 已能攻击到任意敌人 → 不移动
  for (const e of enemies) {
    if (gridDist(unit, e) <= range) return { y: unit.y, x: unit.x, steps: [] };
  }

  const { w, h } = getMapTerrainDimensions(mapResult);
  // goal 集合：与某敌人曼哈顿距 <= range 且可通行、未被占用的空格
  const goalSet = new Set();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = `${y},${x}`;
      if (occupied.has(k)) continue;
      if (!isPassableCell(y, x, mapResult, objMap)) continue;
      for (const e of enemies) {
        if (Math.abs(y - e.y) + Math.abs(x - e.x) <= range) {
          goalSet.add(k);
          break;
        }
      }
    }
  }
  if (goalSet.size === 0) return { y: unit.y, x: unit.x, steps: [] };

  const blocked = new Set(occupied);
  blocked.delete(`${unit.y},${unit.x}`);
  const res = dijkstraPath(unit, goalSet, mapResult, objMap, blocked);
  if (!res || res.path.length === 0) return { y: unit.y, x: unit.x, steps: [] };

  // 沿路花费 movement 预算（每格 getMoveCost），走到预算用尽或到达目标
  const budget = Number.isFinite(unit.movement) && unit.movement > 0 ? unit.movement : 3;
  let spent = 0;
  let cur = { y: unit.y, x: unit.x };
  const steps = [];
  for (const [ny, nx] of res.path) {
    const cost = getMoveCost(ny, nx, mapResult, objMap);
    if (spent + cost > budget) break;
    spent += cost;
    cur = { y: ny, x: nx };
    steps.push([ny, nx]);
  }
  return { y: cur.y, x: cur.x, steps };
}
