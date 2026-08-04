/**
 * headless 走位 / 选敌 AI（无 React / DOM）。
 *
 * 忠实移植自前端 `game/src/systems/battleFlowManager.js`：
 *   getReachableTiles / findPath / findPathWithTrapBudget / findPathForAi /
 *   isOccupied / hasTrapAt / hasFireAt / hasUnopenedChestAt / findBestMoveTarget。
 *
 * 单一来源约束（与 17-5 §12.13 一致）：
 *   - 移动消耗 / 可通行复用 `tacticalGridModel.getMoveCost`（与 battleFlowManager.getMoveCost 同语义）。
 *   - 唯一前端依赖 `getBattleAiStyle` 已内联（仅读 `troop.battleAiStyle` / `aiBattleStyle`，缺省 `'balanced'`）。
 *   - PvP 禁 chest/trap，故 `prioritizeChests=false`、陷阱/火焰分支天然 inert；仍保留以保证行为与前端一致、便于未来复用。
 *
 * 与 battleFlowManager 的差异（仅工程性，不改决策）：
 *   - `battleTroops` 即推演 `allUnits`（unit 含 .y/.x/.currentTroops/.faction/.movement/.range）。
 *   - 路径返回 `Array<{y,x}>`（与前端一致）；调用方（内核）自行转 `[y,x]` 事件格式。
 *
 * @see game/src/systems/battleFlowManager.js
 */

import { getMapTerrainDimensions } from '../../utils/tacticalBattleGrid.js';
import { getMoveCost, gridDist as dist, troopAttackRange } from './tacticalGridModel.js';

export { dist, troopAttackRange };

/** 坐标是否在 `mapResult.terrain` 范围内（无 terrain 时回退 8×10） */
function inBounds(y, x, mapResult) {
  const { w, h } = getMapTerrainDimensions(mapResult);
  return y >= 0 && y < h && x >= 0 && x < w;
}

/**
 * 归一化 AI 风格（内联自 `battleCommanderRules.getBattleAiStyle`）。
 * @returns {'attack'|'defense'|'balanced'}
 */
export function getBattleAiStyle(troop) {
  const s = troop?.battleAiStyle ?? troop?.aiBattleStyle;
  if (s === 'attack') return 'attack';
  if (s === 'defense') return 'defense';
  return 'balanced';
}

// ── 占据 / 危险格检查 ──────────────────────────────────────────────────────────

/** 格子是否被其他活着的部队占据（排除 excludeTroop） */
export function isOccupied(y, x, excludeTroop, battleTroops) {
  return battleTroops.some(
    (t) => t.currentTroops > 0 && t !== excludeTroop && t.y === y && t.x === x,
  );
}

/** 格子是否为陷阱（路过扣兵力，与战术引擎判定一致） */
export function hasTrapAt(y, x, mapResult) {
  if (!mapResult?.objects?.length) return false;
  return mapResult.objects.some((o) => o.y === y && o.x === x && o.type === 'trap');
}

/** 格子是否着火（回合结束时站在上面扣兵力） */
export function hasFireAt(y, x, mapResult) {
  return !!mapResult?.cellFire?.[y]?.[x];
}

/** 格子是否有未开启的宝箱 */
export function hasUnopenedChestAt(y, x, mapResult) {
  if (!mapResult?.objects?.length) return false;
  return mapResult.objects.some(
    (o) => o.y === y && o.x === x && o.type === 'chest' && !o.isOpen,
  );
}

// ── BFS 可达格子 ──────────────────────────────────────────────────────────────

/**
 * BFS 计算可达格子（考虑地形消耗、障碍物、其他部队）。
 * @returns {Map<string, number>} key "y,x" → 剩余移动力
 */
export function getReachableTiles(troop, mapResult, battleTroops, objMap) {
  const maxMove = troop.movement || 3;
  const visited = new Map();
  const queue = [{ y: troop.y, x: troop.x, rem: maxMove }];
  visited.set(`${troop.y},${troop.x}`, maxMove);
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  while (queue.length > 0) {
    const { y, x, rem } = queue.shift();
    for (const [dy, dx] of dirs) {
      const ny = y + dy, nx = x + dx;
      if (!inBounds(ny, nx, mapResult)) continue;
      const cost = getMoveCost(ny, nx, mapResult, objMap);
      if (cost === Infinity) continue;
      if (isOccupied(ny, nx, troop, battleTroops)) continue;
      const newRem = rem - cost;
      if (newRem < 0) continue;
      const key = `${ny},${nx}`;
      if (visited.has(key) && visited.get(key) >= newRem) continue;
      visited.set(key, newRem);
      queue.push({ y: ny, x: nx, rem: newRem });
    }
  }
  visited.delete(`${troop.y},${troop.x}`);
  return visited;
}

// ── BFS 寻路 ──────────────────────────────────────────────────────────────────

/**
 * BFS 寻路：从部队当前位置到 (ty,tx) 的最短路径。
 * @returns {Array<{y:number,x:number}>|null}
 */
export function findPath(troop, ty, tx, mapResult, battleTroops, objMap) {
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
      if (!inBounds(ny, nx, mapResult)) continue;
      const cost = getMoveCost(ny, nx, mapResult, objMap);
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
  return null;
}

/**
 * 在步数预算内寻路，且优先减少「踩陷阱」次数（陷阱步数 ≤ maxTrapSteps）。
 * 与 findPath 相同移动力规则，仅寻路目标不同。
 */
export function findPathWithTrapBudget(troop, ty, tx, mapResult, battleTroops, maxTrapSteps, objMap) {
  const maxMove = troop.movement || 3;
  const sy = troop.y, sx = troop.x;
  const { w: W, h: H } = getMapTerrainDimensions(mapResult);
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
      if (!inBounds(ny, nx, mapResult)) continue;
      const cost = getMoveCost(ny, nx, mapResult, objMap);
      if (cost === Infinity) continue;
      if (isOccupied(ny, nx, troop, battleTroops) && !(ny === ty && nx === tx)) continue;
      const newRem = rem - cost;
      if (newRem < 0) continue;
      const tadd = (hasTrapAt(ny, nx, mapResult) || hasFireAt(ny, nx, mapResult)) ? 1 : 0;
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
export function findPathForAi(troop, ty, tx, mapResult, battleTroops, objMap) {
  for (let maxT = 0; maxT <= 16; maxT++) {
    const p = findPathWithTrapBudget(troop, ty, tx, mapResult, battleTroops, maxT, objMap);
    if (p) return p;
  }
  return findPath(troop, ty, tx, mapResult, battleTroops, objMap);
}

// ── AI 决策 ────────────────────────────────────────────────────────────────────

/**
 * AI 决策：接敌时优先「打满射程」；弓兵尽量脱离贴脸再打远程。
 *
 * @param {Object} troop - 当前行动的部队
 * @param {Object[]} battleTroops - 全部战场部队
 * @param {Object} mapResult
 * @param {Object} [opts]
 * @param {boolean} [opts.prioritizeChests=false] 自动战斗时优先前往宝箱（PvP 恒 false）
 * @param {Map<string,Object>} [opts.objMap] 预构建的对象索引（性能用，可选）
 * @returns {{ move: Array<{y,x}>|null, target: Object|null }|null}
 */
export function findBestMoveTarget(troop, battleTroops, mapResult, opts = {}) {
  const { prioritizeChests = false, objMap } = opts;
  const aiStyle = getBattleAiStyle(troop);
  const enemies = troop.faction === 'enemy'
    ? battleTroops.filter((t) => (t.faction === 'player' || t.faction === 'ally') && t.currentTroops > 0)
    : battleTroops.filter((t) => t.faction === 'enemy' && t.currentTroops > 0);
  if (enemies.length === 0) return null;

  let closestEnemy = null, closestDist = Infinity;
  for (const e of enemies) {
    const d = dist(troop, e);
    if (d < closestDist) { closestDist = d; closestEnemy = e; }
  }
  if (!closestEnemy) return null;

  const atkRange = troopAttackRange(troop);
  const reachable = getReachableTiles(troop, mapResult, battleTroops, objMap);

  // ── 宝箱优先（PvP 恒 false；保留以与前端自动战一致） ──
  if (prioritizeChests && mapResult?.objects) {
    if (hasUnopenedChestAt(troop.y, troop.x, mapResult)) {
      if (closestDist <= atkRange) return { move: null, target: closestEnemy };
      return { move: null, target: null };
    }
    const chestTiles = [];
    for (const [key] of reachable) {
      const [ry, rx] = key.split(',').map(Number);
      if (isOccupied(ry, rx, troop, battleTroops)) continue;
      if (hasUnopenedChestAt(ry, rx, mapResult)) chestTiles.push({ y: ry, x: rx });
    }
    if (chestTiles.length > 0) {
      let bestChest = null, bestChestTarget = null;
      for (const ct of chestTiles) {
        for (const e of enemies) {
          if (e.currentTroops > 0 && dist(ct, e) <= atkRange) {
            bestChest = ct;
            bestChestTarget = e;
            break;
          }
        }
        if (bestChestTarget) break;
      }
      if (!bestChest) {
        bestChest = chestTiles.reduce((a, b) => dist(troop, a) < dist(troop, b) ? a : b);
      }
      const path = findPathForAi(troop, bestChest.y, bestChest.x, mapResult, battleTroops, objMap);
      return { move: path, target: bestChestTarget };
    }
  }

  /** 落脚点是否有危险（陷阱或火焰） */
  const _hazardAt = (ry, rx) => hasTrapAt(ry, rx, mapResult) || hasFireAt(ry, rx, mapResult);

  /**
   * 在可达格中：若存在能攻击敌的格子，取与敌距离**最大**者（打满射程）；
   * 否则取与敌距离**最小**者（继续接近）。距离相同时优先不站在危险格。
   */
  function pickApproachTile() {
    let bestInRange = null, bestInRangeD = -1;
    let bestInRangeHaz = true;
    let bestClosing = null;
    let bestClosingD = aiStyle === 'defense' ? -1 : Infinity;
    let bestClosingHaz = true;
    const preferClosing = (d, prevD) => {
      if (aiStyle === 'defense') return d > prevD;
      return d < prevD;
    };
    const tieClosing = (d, prevD) => d === prevD;
    for (const [key] of reachable) {
      const [ry, rx] = key.split(',').map(Number);
      if (isOccupied(ry, rx, troop, battleTroops)) continue;
      const d = dist({ y: ry, x: rx }, closestEnemy);
      const haz = _hazardAt(ry, rx);
      if (d <= atkRange) {
        if (d > bestInRangeD) {
          bestInRangeD = d;
          bestInRange = { y: ry, x: rx };
          bestInRangeHaz = haz;
        } else if (d === bestInRangeD && bestInRangeHaz && !haz) {
          bestInRange = { y: ry, x: rx };
          bestInRangeHaz = false;
        }
      } else if (preferClosing(d, bestClosingD)) {
        bestClosingD = d;
        bestClosing = { y: ry, x: rx };
        bestClosingHaz = haz;
      } else if (tieClosing(d, bestClosingD) && bestClosingHaz && !haz) {
        bestClosing = { y: ry, x: rx };
        bestClosingHaz = false;
      }
    }
    return bestInRange || bestClosing;
  }

  /**
   * 已能攻击时仍可能通过一步移动「拉远」：在射程内取与敌距离更大的格（长柄打满、弓兵后撤）。
   * 距离并列时优先落在非危险格。
   */
  function pickRepositionTile() {
    let best = null, bestD = -1, bestHaz = true;
    for (const [key] of reachable) {
      const [ry, rx] = key.split(',').map(Number);
      if (isOccupied(ry, rx, troop, battleTroops)) continue;
      const d = dist({ y: ry, x: rx }, closestEnemy);
      if (d > atkRange) continue;
      const haz = _hazardAt(ry, rx);
      if (d > bestD) {
        bestD = d;
        best = { y: ry, x: rx };
        bestHaz = haz;
      } else if (d === bestD && bestHaz && !haz) {
        best = { y: ry, x: rx };
        bestHaz = false;
      }
    }
    return best && bestD > closestDist ? { tile: best, dist: bestD } : null;
  }

  if (closestDist <= atkRange) {
    const repos = pickRepositionTile();
    if (repos) {
      const path = findPathForAi(troop, repos.tile.y, repos.tile.x, mapResult, battleTroops, objMap);
      if (path && path.length > 0) {
        return { move: path, target: closestEnemy };
      }
    }
    return { move: null, target: closestEnemy };
  }

  const bestPos = pickApproachTile();
  if (!bestPos) return { move: null, target: closestDist <= atkRange ? closestEnemy : null };

  const path = findPathForAi(troop, bestPos.y, bestPos.x, mapResult, battleTroops, objMap);
  const newDist = dist(bestPos, closestEnemy);
  const canAttack = newDist <= atkRange;

  return { move: path, target: canAttack ? closestEnemy : null };
}
