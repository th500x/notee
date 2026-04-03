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

/** 格子是否为陷阱（路过扣兵力，与 useBattleEngine 判定一致） */
export function hasTrapAt(y, x, mapResult) {
  if (!mapResult?.objects?.length) return false;
  return mapResult.objects.some(o => o.y === y && o.x === x && o.type === 'trap');
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

/**
 * 在步数预算内寻找路径，且优先减少「踩陷阱」次数（陷阱步数 ≤ maxTrapSteps）。
 * 与 findPath 相同移动力规则，仅寻路目标不同。
 */
export function findPathWithTrapBudget(troop, ty, tx, mapResult, battleTroops, maxTrapSteps) {
  const maxMove = troop.movement || 3;
  const sy = troop.y, sx = troop.x;
  const H = DEFAULT_MAP_HEIGHT, W = DEFAULT_MAP_WIDTH;
  const INF = 999;
  const minTraps = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => Array(maxMove + 1).fill(INF)));
  const parent = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => Array(maxMove + 1).fill(null)));

  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  minTraps[sy][sx][maxMove] = 0;
  const queue = [{ y: sy, x: sx, rem: maxMove }];

  while (queue.length > 0) {
    const { y, x, rem } = queue.shift();
    const traps = minTraps[y][x][rem];
    if (traps > maxTrapSteps) continue;

    for (const [dy, dx] of dirs) {
      const ny = y + dy, nx = x + dx;
      if (!inBounds(ny, nx)) continue;
      const cost = getMoveCost(ny, nx, mapResult);
      if (cost === Infinity) continue;
      if (isOccupied(ny, nx, troop, battleTroops) && !(ny === ty && nx === tx)) continue;
      const newRem = rem - cost;
      if (newRem < 0) continue;
      const tadd = hasTrapAt(ny, nx, mapResult) ? 1 : 0;
      const newTraps = traps + tadd;
      if (newTraps > maxTrapSteps) continue;
      if (newTraps < minTraps[ny][nx][newRem]) {
        minTraps[ny][nx][newRem] = newTraps;
        parent[ny][nx][newRem] = { y, x, rem };
        queue.push({ y: ny, x: nx, rem: newRem });
      }
    }
  }

  let bestRem = -1;
  let bestT = INF;
  for (let r = 0; r <= maxMove; r++) {
    const t = minTraps[ty][tx][r];
    if (t < bestT || (t === bestT && r > bestRem)) {
      bestT = t;
      bestRem = r;
    }
  }
  if (bestT >= INF) return null;

  const path = [];
  let cy = ty, cx = tx, cr = bestRem;
  while (cy !== sy || cx !== sx) {
    path.unshift({ y: cy, x: cx });
    const p = parent[cy][cx][cr];
    if (!p) return null;
    cy = p.y;
    cx = p.x;
    cr = p.rem;
  }
  return path;
}

/** AI 寻路：先尽量少踩陷阱，再放宽陷阱步数上限，最后回退标准 findPath */
export function findPathForAi(troop, ty, tx, mapResult, battleTroops) {
  for (let maxT = 0; maxT <= 16; maxT++) {
    const p = findPathWithTrapBudget(troop, ty, tx, mapResult, battleTroops, maxT);
    if (p) return p;
  }
  return findPath(troop, ty, tx, mapResult, battleTroops);
}

// ── AI决策 ────────────────────────────────────────────────────────────────────

/**
 * AI决策：接敌时优先「打满射程」；弓兵尽量脱离贴脸再打远程。
 *
 * 旧逻辑在可达格上**最小化**与敌距离，导致 range=2 的枪骑/大戟等仍被拉到贴身；
 * 且已能攻击时不再移动，弓兵被近身后不会后撤。
 *
 * @param {Object} troop - 当前行动的部队
 * @param {Object[]} battleTroops - 全部战场部队
 * @param {Object} mapResult - generateSmallMap 返回的结果
 * @returns {{ move: Array|null, target: Object|null }|null}
 */
export function findBestMoveTarget(troop, battleTroops, mapResult) {
  const enemies = battleTroops.filter(t => t.faction !== troop.faction && t.currentTroops > 0);
  if (enemies.length === 0) return null;

  let closestEnemy = null, closestDist = Infinity;
  for (const e of enemies) {
    const d = dist(troop, e);
    if (d < closestDist) { closestDist = d; closestEnemy = e; }
  }
  if (!closestEnemy) return null;

  const atkRange = troop.range || 1;
  const reachable = getReachableTiles(troop, mapResult, battleTroops);

  /**
   * 在可达格中：若存在能攻击敌的格子，取与敌距离**最大**者（打满射程）；
   * 否则取与敌距离**最小**者（继续接近）。
   * 距离相同时优先**不站在陷阱上**（攻击距离已够时减少无谓损兵）。
   */
  function pickApproachTile() {
    let bestInRange = null, bestInRangeD = -1;
    let bestInRangeTrap = true;
    let bestClosing = null, bestClosingD = Infinity;
    let bestClosingTrap = true;
    for (const [key] of reachable) {
      const [ry, rx] = key.split(',').map(Number);
      if (isOccupied(ry, rx, troop, battleTroops)) continue;
      const d = dist({ y: ry, x: rx }, closestEnemy);
      const trap = hasTrapAt(ry, rx, mapResult);
      if (d <= atkRange) {
        if (d > bestInRangeD) {
          bestInRangeD = d;
          bestInRange = { y: ry, x: rx };
          bestInRangeTrap = trap;
        } else if (d === bestInRangeD && bestInRangeTrap && !trap) {
          bestInRange = { y: ry, x: rx };
          bestInRangeTrap = false;
        }
      } else if (d < bestClosingD) {
        bestClosingD = d;
        bestClosing = { y: ry, x: rx };
        bestClosingTrap = trap;
      } else if (d === bestClosingD && bestClosingTrap && !trap) {
        bestClosing = { y: ry, x: rx };
        bestClosingTrap = false;
      }
    }
    return bestInRange || bestClosing;
  }

  /**
   * 已能攻击时仍可能通过一步移动「拉远」：在射程内取与敌距离更大的格（长柄打满、弓兵后撤）
   * 距离并列时优先落在非陷阱格。
   */
  function pickRepositionTile() {
    let best = null, bestD = -1, bestTrap = true;
    for (const [key] of reachable) {
      const [ry, rx] = key.split(',').map(Number);
      if (isOccupied(ry, rx, troop, battleTroops)) continue;
      const d = dist({ y: ry, x: rx }, closestEnemy);
      if (d > atkRange) continue;
      const trap = hasTrapAt(ry, rx, mapResult);
      if (d > bestD) {
        bestD = d;
        best = { y: ry, x: rx };
        bestTrap = trap;
      } else if (d === bestD && bestTrap && !trap) {
        best = { y: ry, x: rx };
        bestTrap = false;
      }
    }
    return best && bestD > closestDist ? { tile: best, dist: bestD } : null;
  }

  if (closestDist <= atkRange) {
    const repos = pickRepositionTile();
    if (repos) {
      const path = findPathForAi(troop, repos.tile.y, repos.tile.x, mapResult, battleTroops);
      if (path && path.length > 0) {
        return { move: path, target: closestEnemy };
      }
    }
    // 弓兵贴脸且无法拉远：仍按近战演出攻击（performAttack 同格）
    return { move: null, target: closestEnemy };
  }

  const bestPos = pickApproachTile();
  if (!bestPos) return { move: null, target: closestDist <= atkRange ? closestEnemy : null };

  const path = findPathForAi(troop, bestPos.y, bestPos.x, mapResult, battleTroops);
  const newDist = dist(bestPos, closestEnemy);
  const canAttack = newDist <= atkRange;

  return { move: path, target: canAttack ? closestEnemy : null };
}
