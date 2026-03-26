/**
 * 战斗流程管理器
 *
 * 负责：移动系统（地形消耗、BFS寻路、可达格子）、AI决策、回合流程
 * 从 demo/map-generator-demo.html 提取，逻辑完全一致
 *
 * @see docs/10-core-system/17-1-COMBAT_SYSTEM.md
 */

// 地图尺寸常量（与 mapGenerator 保持一致）
// 后续支持中型/大型地图时，这些值需要作为参数传入
const DEFAULT_MAP_WIDTH = 8;
const DEFAULT_MAP_HEIGHT = 10;

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/** 检查坐标是否在地图范围内 */
function inBounds(y, x, mapWidth = DEFAULT_MAP_WIDTH, mapHeight = DEFAULT_MAP_HEIGHT) {
  return y >= 0 && y < mapHeight && x >= 0 && x < mapWidth;
}

/** 计算两点曼哈顿距离 */
export function dist(a, b) {
  return Math.abs(a.y - b.y) + Math.abs(a.x - b.x);
}

// ── 地形移动消耗 ──────────────────────────────────────────────────────────────

/**
 * 获取格子的移动消耗
 * @param {number} y - 行坐标
 * @param {number} x - 列坐标
 * @param {Object} mapResult - generateSmallMap 返回的结果
 * @returns {number} 移动消耗（Infinity=不可通行）
 */
export function getMoveCost(y, x, mapResult) {
  if (!mapResult) return 1;
  const t = mapResult.terrain[y]?.[x];
  // 检查障碍物
  const obj = mapResult.objects.find(o => o.y === y && o.x === x);
  if (obj && !obj.isPassable) return Infinity; // rock/fence不可通行
  let cost = 1; // 平原/荒地/陷阱 = 1
  if (t === 'forest') cost = 2; // 树林+1
  if (t === 'hill')   cost = 2; // 丘陵+1
  // 着火地形+2（叠加在原地形上）
  // TODO: fire terrain when implemented
  return cost;
}

// ── 占据检查 ──────────────────────────────────────────────────────────────────

/**
 * 检查格子是否被其他活着的部队占据
 * @param {number} y
 * @param {number} x
 * @param {Object} excludeTroop - 排除的部队
 * @param {Object[]} battleTroops - 全部战场部队
 * @returns {boolean}
 */
export function isOccupied(y, x, excludeTroop, battleTroops) {
  return battleTroops.some(t => t.currentTroops > 0 && t !== excludeTroop && t.y === y && t.x === x);
}

// ── BFS可达格子 ──────────────────────────────────────────────────────────────

/**
 * BFS计算可达格子（考虑地形消耗、障碍物、其他部队）
 * @param {Object} troop - 部队对象
 * @param {Object} mapResult - generateSmallMap 返回的结果
 * @param {Object[]} battleTroops - 全部战场部队
 * @returns {Map<string, number>} key "y,x" → 剩余移动力
 */
export function getReachableTiles(troop, mapResult, battleTroops) {
  const maxMove = troop.movement || 3;
  const visited = new Map(); // key "y,x" → remaining movement
  const queue = [{ y: troop.y, x: troop.x, rem: maxMove }];
  visited.set(`${troop.y},${troop.x}`, maxMove);
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  while (queue.length > 0) {
    const { y, x, rem } = queue.shift();
    for (const [dy, dx] of dirs) {
      const ny = y + dy, nx = x + dx;
      if (!inBounds(ny, nx)) continue;
      const cost = getMoveCost(ny, nx, mapResult);
      if (cost === Infinity) continue; // 障碍物
      if (isOccupied(ny, nx, troop, battleTroops)) continue; // 被占据
      const newRem = rem - cost;
      if (newRem < 0) continue;
      const key = `${ny},${nx}`;
      if (visited.has(key) && visited.get(key) >= newRem) continue;
      visited.set(key, newRem);
      queue.push({ y: ny, x: nx, rem: newRem });
    }
  }
  // 移除起点
  visited.delete(`${troop.y},${troop.x}`);
  return visited;
}

// ── BFS寻路 ──────────────────────────────────────────────────────────────────

/**
 * BFS寻路：找到从部队当前位置到(ty,tx)的最短路径
 * @param {Object} troop - 部队对象
 * @param {number} ty - 目标行
 * @param {number} tx - 目标列
 * @param {Object} mapResult - generateSmallMap 返回的结果
 * @param {Object[]} battleTroops - 全部战场部队
 * @returns {Array<{y:number,x:number}>|null} 路径数组或null
 */
export function findPath(troop, ty, tx, mapResult, battleTroops) {
  const maxMove = troop.movement || 3;
  const start = { y: troop.y, x: troop.x };
  const visited = new Map();
  const queue = [{ y: start.y, x: start.x, rem: maxMove, path: [] }];
  visited.set(`${start.y},${start.x}`, maxMove);
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  while (queue.length > 0) {
    const { y, x, rem, path } = queue.shift();
    if (y === ty && x === tx) return path;
    for (const [dy, dx] of dirs) {
      const ny = y + dy, nx = x + dx;
      if (!inBounds(ny, nx)) continue;
      const cost = getMoveCost(ny, nx, mapResult);
      if (cost === Infinity) continue;
      if (isOccupied(ny, nx, troop, battleTroops) && !(ny === ty && nx === tx)) continue;
      const newRem = rem - cost;
      if (newRem < 0) continue;
      const key = `${ny},${nx}`;
      if (visited.has(key) && visited.get(key) >= newRem) continue;
      visited.set(key, newRem);
      queue.push({ y: ny, x: nx, rem: newRem, path: [...path, { y: ny, x: nx }] });
    }
  }
  return null; // 不可达
}

// ── AI决策 ────────────────────────────────────────────────────────────────────

/**
 * AI决策：找到最佳移动目标（向最近的敌人靠近）
 * @param {Object} troop - 当前行动的部队
 * @param {Object[]} battleTroops - 全部战场部队
 * @param {Object} mapResult - generateSmallMap 返回的结果
 * @returns {{ move: Array|null, target: Object|null }|null}
 */
export function findBestMoveTarget(troop, battleTroops, mapResult) {
  const enemies = battleTroops.filter(t => t.faction !== troop.faction && t.currentTroops > 0);
  if (enemies.length === 0) return null;

  // 找最近的敌人
  let closestEnemy = null, closestDist = Infinity;
  for (const e of enemies) {
    const d = dist(troop, e);
    if (d < closestDist) { closestDist = d; closestEnemy = e; }
  }
  if (!closestEnemy) return null;

  const atkRange = troop.range || 1;

  // 已经在攻击范围内，不需要移动
  if (closestDist <= atkRange) return { move: null, target: closestEnemy };

  // 计算可达格子
  const reachable = getReachableTiles(troop, mapResult, battleTroops);

  // 在可达格子中找到离目标最近的位置
  let bestPos = null, bestDist = Infinity;
  for (const [key] of reachable) {
    const [ry, rx] = key.split(',').map(Number);
    // 不能移动到被占据的格子
    if (isOccupied(ry, rx, troop, battleTroops)) continue;
    const d = Math.abs(ry - closestEnemy.y) + Math.abs(rx - closestEnemy.x);
    if (d < bestDist) { bestDist = d; bestPos = { y: ry, x: rx }; }
  }

  if (!bestPos) return { move: null, target: closestDist <= atkRange ? closestEnemy : null };

  // 寻路到最佳位置
  const path = findPath(troop, bestPos.y, bestPos.x, mapResult, battleTroops);

  // 移动后是否在攻击范围内
  const newDist = Math.abs(bestPos.y - closestEnemy.y) + Math.abs(bestPos.x - closestEnemy.x);
  const canAttack = newDist <= atkRange;

  return { move: path, target: canAttack ? closestEnemy : null };
}
