/**
 * 战斗流程管理器
 *
 * 负责：移动系统（地形消耗、BFS寻路、可达格子）、AI决策、回合流程
 * 从 demo/map-generator-demo.html 提取，逻辑完全一致
 *
 * @see docs/00/10-core-system/17-1-COMBAT_SYSTEM.md
 */

import { getBattleAiStyle } from '@/systems/battleCommanderRules';
import { getMapTerrainDimensions } from '@shared/utils/tacticalBattleGrid';

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/** 检查坐标是否在 `mapResult.terrain` 范围内（无 terrain 时回退 8×10） */
function inBounds(y, x, mapResult) {
  const { w, h } = getMapTerrainDimensions(mapResult);
  return y >= 0 && y < h && x >= 0 && x < w;
}

/** 计算两点曼哈顿距离 */
export function dist(a, b) {
  return Math.abs(a.y - b.y) + Math.abs(a.x - b.x);
}

/** 规范化部队攻击射程（JSON 可能为字符串；避免 `"2" + 1` 等拼接错误） */
export function troopAttackRange(troop) {
  const r = Number(troop?.range);
  return Number.isFinite(r) && r > 0 ? r : 1;
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
  // 大型图切片：河/湖不可通行（与战略格一致）；v2 熔岩同不可走；桥可通行
  if (t === 'river' || t === 'lake' || t === 'lava') return Infinity;
  // 检查障碍物
  const obj = mapResult.objects.find(o => o.y === y && o.x === x);
  if (obj && !obj.isPassable) return Infinity; // rock/fence不可通行
  let cost = 1; // 平原/荒地/陷阱 = 1
  if (t === 'forest') cost = 2; // 树林+1
  if (t === 'hill')   cost = 2; // 丘陵+1
  if (mapResult.cellFire?.[y]?.[x]) cost += 2;
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

/** 格子是否为陷阱（路过扣兵力，与战术引擎判定一致） */
export function hasTrapAt(y, x, mapResult) {
  if (!mapResult?.objects?.length) return false;
  return mapResult.objects.some(o => o.y === y && o.x === x && o.type === 'trap');
}

/** 格子是否着火（回合结束时站在上面扣 20% 兵力） */
export function hasFireAt(y, x, mapResult) {
  return !!mapResult?.cellFire?.[y]?.[x];
}

/** 格子是否有未开启的宝箱 */
export function hasUnopenedChestAt(y, x, mapResult) {
  if (!mapResult?.objects?.length) return false;
  return mapResult.objects.some(o => o.y === y && o.x === x && o.type === 'chest' && !o.isOpen);
}

/** 格子是否有未开启的随机箱 */
export function hasUnopenedRandomAt(y, x, mapResult) {
  if (!mapResult?.objects?.length) return false;
  return mapResult.objects.some(o => o.y === y && o.x === x && o.type === 'random' && !o.isOpen);
}

/** 格子是否为未消耗农场 */
export function hasFarmAt(y, x, mapResult) {
  if (!mapResult?.objects?.length) return false;
  return mapResult.objects.some(o => o.y === y && o.x === x && o.type === 'farm' && !o.isOpen);
}

export function mapHasWaterTerrain(mapResult) {
  const terrain = mapResult?.terrain;
  if (!Array.isArray(terrain)) return false;
  for (const row of terrain) {
    for (const c of row || []) {
      if (c === 'river' || c === 'bridge' || c === 'lake') return true;
    }
  }
  return false;
}

function cellNearWater(y, x, mapResult) {
  for (const [dy, dx] of [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const t = mapResult?.terrain?.[y + dy]?.[x + dx];
    if (t === 'river' || t === 'bridge' || t === 'lake') return true;
  }
  return false;
}

// ── BFS可达格子 ──────────────────────────────────────────────────────────────

/**
 * BFS计算可达格子（考虑地形消耗、障碍物、其他部队）
 * @param {Object} troop - 部队对象
 * @param {Object} mapResult - generateSmallMap 返回的结果
 * @param {Object[]} battleTroops - 全部战场部队
 * @returns {Map<string, number>} key "y,x" → 剩余移动力
 */
export function getReachableTiles(troop, mapResult, battleTroops, maxMoveOverride = null) {
  const maxMove = maxMoveOverride != null ? maxMoveOverride : (troop.movement || 3);
  const visited = new Map(); // key "y,x" → remaining movement
  const queue = [{ y: troop.y, x: troop.x, rem: maxMove }];
  visited.set(`${troop.y},${troop.x}`, maxMove);
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  while (queue.length > 0) {
    const { y, x, rem } = queue.shift();
    for (const [dy, dx] of dirs) {
      const ny = y + dy, nx = x + dx;
      if (!inBounds(ny, nx, mapResult)) continue;
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
      if (!inBounds(ny, nx, mapResult)) continue;
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
      const cost = getMoveCost(ny, nx, mapResult);
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
export function findPathForAi(troop, ty, tx, mapResult, battleTroops) {
  for (let maxT = 0; maxT <= 16; maxT++) {
    const p = findPathWithTrapBudget(troop, ty, tx, mapResult, battleTroops, maxT);
    if (p) return p;
  }
  return findPath(troop, ty, tx, mapResult, battleTroops);
}

/** 落脚/路过格是否为危险格（陷阱或火焰）——踩中均按损兵处理，AI 一律视为应规避 */
export function isHazardTile(y, x, mapResult) {
  return hasTrapAt(y, x, mapResult) || hasFireAt(y, x, mapResult);
}

/**
 * BFS 可达格（**不踩陷阱/火焰** 版）：进入危险格视为不可通行。
 * 用于「陷阱规避优先」——只在这些格里选落脚点，确保本回合移动全程不踩陷阱。
 */
export function getReachableTilesSafe(troop, mapResult, battleTroops, maxMoveOverride = null) {
  const maxMove = maxMoveOverride != null ? maxMoveOverride : (troop.movement || 3);
  const visited = new Map();
  const queue = [{ y: troop.y, x: troop.x, rem: maxMove }];
  visited.set(`${troop.y},${troop.x}`, maxMove);
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  while (queue.length > 0) {
    const { y, x, rem } = queue.shift();
    for (const [dy, dx] of dirs) {
      const ny = y + dy, nx = x + dx;
      if (!inBounds(ny, nx, mapResult)) continue;
      const cost = getMoveCost(ny, nx, mapResult);
      if (cost === Infinity) continue;
      if (isHazardTile(ny, nx, mapResult)) continue; // 不踩陷阱/火
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

/**
 * 是否存在「**完全不踩陷阱**」即可抵达 `enemy` 攻击射程内的路线（忽略本回合移动力，跨回合可达即算）。
 *
 * 用作「陷阱规避优先」的**唯一例外**判定：返回 `false`（道路被陷阱/障碍/单位彻底卡死、无任何
 * 无陷阱路线可接近敌人）时，才允许 AI 踩最少陷阱前进；否则一律绕路或原地等敌人靠近，绝不踩陷阱。
 */
export function existsTrapFreeApproach(troop, enemy, atkRange, mapResult, battleTroops) {
  if (dist({ y: troop.y, x: troop.x }, enemy) <= atkRange) return true;
  const { w: W, h: H } = getMapTerrainDimensions(mapResult);
  const seen = Array.from({ length: H }, () => Array(W).fill(false));
  const queue = [{ y: troop.y, x: troop.x }];
  seen[troop.y][troop.x] = true;
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  while (queue.length > 0) {
    const { y, x } = queue.shift();
    for (const [dy, dx] of dirs) {
      const ny = y + dy, nx = x + dx;
      if (!inBounds(ny, nx, mapResult)) continue;
      if (seen[ny][nx]) continue;
      if (getMoveCost(ny, nx, mapResult) === Infinity) continue; // 河湖/障碍
      if (isHazardTile(ny, nx, mapResult)) continue; // 陷阱/火：不可踩
      if (isOccupied(ny, nx, troop, battleTroops)) continue; // 其他部队占据
      seen[ny][nx] = true;
      if (dist({ y: ny, x: nx }, enemy) <= atkRange) return true;
      queue.push({ y: ny, x: nx });
    }
  }
  return false;
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
/**
 * @param {Object} troop
 * @param {Object[]} battleTroops
 * @param {Object} mapResult
 * @param {Object} [opts]
 * @param {boolean} [opts.prioritizeChests=false] 自动战斗时 player 部队优先前往宝箱
 */
export function findBestMoveTarget(troop, battleTroops, mapResult, opts = {}) {
  const { prioritizeChests = false } = opts;
  const aiStyle = getBattleAiStyle(troop);
  const enemies = troop.faction === 'enemy'
    ? battleTroops.filter(t => (t.faction === 'player' || t.faction === 'ally') && t.currentTroops > 0)
    : battleTroops.filter(t => t.faction === 'enemy' && t.currentTroops > 0);
  if (enemies.length === 0) return null;

  let closestEnemy = null, closestDist = Infinity;
  for (const e of enemies) {
    const d = dist(troop, e);
    if (d < closestDist) { closestDist = d; closestEnemy = e; }
  }
  if (!closestEnemy) return null;

  const atkRange = troopAttackRange(troop);
  const hp = troop.currentTroops || 0;
  const isRanged = atkRange > 1;
  const hasWater = mapHasWaterTerrain(mapResult);
  const avoidFarmWaste = hp > 200;
  const seekFarm =
    (troop.faction === 'player' && hp > 0 && hp < 100) ||
    (troop.faction === 'enemy' && hp > 0 && hp < 50);

  // 陷阱规避优先（优先级高于攻击/接敌）：只要存在「不踩陷阱」抵达敌人射程的路线，本回合就
  // 只在无陷阱可达格里选落脚点、并走无陷阱路径；唯有道路被陷阱彻底卡死时（`allowTrap`）才允许踩。
  const allowTrap = !existsTrapFreeApproach(troop, closestEnemy, atkRange, mapResult, battleTroops);
  const reachable = allowTrap
    ? getReachableTiles(troop, mapResult, battleTroops)
    : getReachableTilesSafe(troop, mapResult, battleTroops);
  const planPath = (ty, tx) =>
    allowTrap
      ? findPathForAi(troop, ty, tx, mapResult, battleTroops)
      : findPathWithTrapBudget(troop, ty, tx, mapResult, battleTroops, 0)
        || findPathForAi(troop, ty, tx, mapResult, battleTroops);

  // ── 农场：低兵力且 1～2 回合可达 → 优先前往 ──
  if (seekFarm && mapResult?.objects) {
    const move = troop.movement || 3;
    const reach2 = allowTrap
      ? getReachableTiles(troop, mapResult, battleTroops, move * 2)
      : getReachableTilesSafe(troop, mapResult, battleTroops, move * 2);
    const farmTiles = [];
    for (const o of mapResult.objects) {
      if (o.type !== 'farm') continue;
      if (isOccupied(o.y, o.x, troop, battleTroops)) continue;
      if (o.y === troop.y && o.x === troop.x) {
        // 已在农场：就地治疗由踏入逻辑处理；本回合可攻击则打
        if (closestDist <= atkRange) return { move: null, target: closestEnemy };
        return { move: null, target: null };
      }
      if (reach2.has(`${o.y},${o.x}`)) farmTiles.push({ y: o.y, x: o.x });
    }
    if (farmTiles.length > 0) {
      const bestFarm = farmTiles.reduce((a, b) => dist(troop, a) < dist(troop, b) ? a : b);
      // 本回合可达则走过去；否则朝农场方向走近
      if (reachable.has(`${bestFarm.y},${bestFarm.x}`)) {
        const path = planPath(bestFarm.y, bestFarm.x);
        return { move: path, target: null };
      }
      let step = null;
      let bestD = Infinity;
      for (const [key] of reachable) {
        const [ry, rx] = key.split(',').map(Number);
        if (isOccupied(ry, rx, troop, battleTroops)) continue;
        if (avoidFarmWaste && hasFarmAt(ry, rx, mapResult)) continue;
        const d = dist({ y: ry, x: rx }, bestFarm);
        if (d < bestD) {
          bestD = d;
          step = { y: ry, x: rx };
        }
      }
      if (step) {
        const path = planPath(step.y, step.x);
        return { move: path, target: null };
      }
    }
  }

  // ── 宝箱 / 随机箱优先（仅 auto-battle player 部队） ──
  if (prioritizeChests && mapResult?.objects) {
    if (hasUnopenedChestAt(troop.y, troop.x, mapResult) || hasUnopenedRandomAt(troop.y, troop.x, mapResult)) {
      if (closestDist <= atkRange) return { move: null, target: closestEnemy };
      return { move: null, target: null };
    }
    const interactTiles = [];
    for (const [key] of reachable) {
      const [ry, rx] = key.split(',').map(Number);
      if (isOccupied(ry, rx, troop, battleTroops)) continue;
      if (hasUnopenedChestAt(ry, rx, mapResult) || hasUnopenedRandomAt(ry, rx, mapResult)) {
        interactTiles.push({ y: ry, x: rx });
      }
    }
    if (interactTiles.length > 0) {
      let bestChest = null, bestChestTarget = null;
      for (const ct of interactTiles) {
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
        bestChest = interactTiles.reduce((a, b) => dist(troop, a) < dist(troop, b) ? a : b);
      }
      const path = planPath(bestChest.y, bestChest.x);
      return { move: path, target: bestChestTarget };
    }
  }

  /** 落脚点是否有危险（陷阱或火焰） */
  const _hazardAt = (ry, rx) => isHazardTile(ry, rx, mapResult);

  /**
   * 在可达格中：若存在能攻击敌的格子，取与敌距离**最大**者（打满射程）；
   * 否则取与敌距离**最小**者（继续接近）。
   * 距离相同时优先**不站在危险格**（陷阱 / 火焰）；有水域时远程优先靠岸。
   * 兵力 >200 时回避农场格（避免浪费补给）。
   */
  function pickApproachTile() {
    let bestInRange = null, bestInRangeD = -1;
    let bestInRangeHaz = true;
    let bestInRangeWater = false;
    let bestClosing = null;
    let bestClosingD = aiStyle === 'defense' ? -1 : Infinity;
    let bestClosingHaz = true;
    let bestClosingWater = false;
    const preferClosing = (d, prevD) => {
      if (aiStyle === 'defense') return d > prevD;
      return d < prevD;
    };
    const tieClosing = (d, prevD) => {
      if (aiStyle === 'defense') return d === prevD;
      return d === prevD;
    };
    const betterWaterTie = (isNewNear, wasNear) => isRanged && hasWater && isNewNear && !wasNear;
    for (const [key] of reachable) {
      const [ry, rx] = key.split(',').map(Number);
      if (isOccupied(ry, rx, troop, battleTroops)) continue;
      if (avoidFarmWaste && hasFarmAt(ry, rx, mapResult)) continue;
      const d = dist({ y: ry, x: rx }, closestEnemy);
      const haz = _hazardAt(ry, rx);
      const nearW = cellNearWater(ry, rx, mapResult);
      if (d <= atkRange) {
        if (d > bestInRangeD) {
          bestInRangeD = d;
          bestInRange = { y: ry, x: rx };
          bestInRangeHaz = haz;
          bestInRangeWater = nearW;
        } else if (d === bestInRangeD) {
          if (bestInRangeHaz && !haz) {
            bestInRange = { y: ry, x: rx };
            bestInRangeHaz = false;
            bestInRangeWater = nearW;
          } else if (haz === bestInRangeHaz && betterWaterTie(nearW, bestInRangeWater)) {
            bestInRange = { y: ry, x: rx };
            bestInRangeWater = nearW;
          }
        }
      } else if (preferClosing(d, bestClosingD)) {
        bestClosingD = d;
        bestClosing = { y: ry, x: rx };
        bestClosingHaz = haz;
        bestClosingWater = nearW;
      } else if (tieClosing(d, bestClosingD)) {
        if (bestClosingHaz && !haz) {
          bestClosing = { y: ry, x: rx };
          bestClosingHaz = false;
          bestClosingWater = nearW;
        } else if (haz === bestClosingHaz && betterWaterTie(nearW, bestClosingWater)) {
          bestClosing = { y: ry, x: rx };
          bestClosingWater = nearW;
        }
      }
    }
    return bestInRange || bestClosing;
  }

  /**
   * 已能攻击时仍可能通过一步移动「拉远」：在射程内取与敌距离更大的格（长柄打满、弓兵后撤）
   * 距离并列时优先落在非危险格（陷阱 / 火焰）；有水域时远程优先靠岸。
   */
  function pickRepositionTile() {
    let best = null, bestD = -1, bestHaz = true, bestWater = false;
    for (const [key] of reachable) {
      const [ry, rx] = key.split(',').map(Number);
      if (isOccupied(ry, rx, troop, battleTroops)) continue;
      if (avoidFarmWaste && hasFarmAt(ry, rx, mapResult)) continue;
      const d = dist({ y: ry, x: rx }, closestEnemy);
      if (d > atkRange) continue;
      const haz = _hazardAt(ry, rx);
      const nearW = cellNearWater(ry, rx, mapResult);
      if (d > bestD) {
        bestD = d;
        best = { y: ry, x: rx };
        bestHaz = haz;
        bestWater = nearW;
      } else if (d === bestD) {
        if (bestHaz && !haz) {
          best = { y: ry, x: rx };
          bestHaz = false;
          bestWater = nearW;
        } else if (haz === bestHaz && isRanged && hasWater && nearW && !bestWater) {
          best = { y: ry, x: rx };
          bestWater = nearW;
        }
      }
    }
    return best && bestD > closestDist ? { tile: best, dist: bestD } : null;
  }

  if (closestDist <= atkRange) {
    const repos = pickRepositionTile();
    if (repos) {
      const path = planPath(repos.tile.y, repos.tile.x);
      if (path && path.length > 0) {
        return { move: path, target: closestEnemy };
      }
    }
    // 弓兵贴脸且无法拉远：仍按近战演出攻击（performAttack 同格）
    return { move: null, target: closestEnemy };
  }

  const bestPos = pickApproachTile();
  if (!bestPos) return { move: null, target: null };

  const newDist = dist(bestPos, closestEnemy);
  const canAttack = newDist <= atkRange;

  // 陷阱规避优先：存在无陷阱路线时，若无陷阱可达格里既打不到、也无法更接近，
  // 宁可原地等敌人靠近（或后续回合绕路），也不踩陷阱。防御型本就偏拉开，不在此等待。
  if (!allowTrap && !canAttack && aiStyle !== 'defense' && newDist >= closestDist) {
    return { move: null, target: null };
  }

  const path = planPath(bestPos.y, bestPos.x);
  return { move: path, target: canAttack ? closestEnemy : null };
}
