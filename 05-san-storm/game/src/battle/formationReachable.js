/**
 * 阵型整体移动：中心点 BFS + 各成员偏移落位校验（与 tacticalBattleEngine.formationGroupMove 一致）
 *
 * 纯函数；执行层须沿 BFS 中心路径逐步 formationGroupMove，禁止「先整段纵移再横移」，
 * 否则合法终点可能因中间步撞巨石等被错误拒绝。
 */
import { getMoveCost, isHazardTile } from '@/systems/battleFlowManager';
import { getMapTerrainDimensions } from '@shared/utils/tacticalBattleGrid';

function buildFormationFrame(alive) {
  const centerY = Math.round(alive.reduce((s, t) => s + t.y, 0) / alive.length);
  const centerX = Math.round(alive.reduce((s, t) => s + t.x, 0) / alive.length);
  const offsets = alive.map((t) => ({ dy: t.y - centerY, dx: t.x - centerX }));
  const fSet = new Set(alive.map((t) => `${t.y},${t.x}`));
  return { centerY, centerX, offsets, fSet };
}

/** 中心落在 (cy,cx) 时，各成员格是否可站、可通行、未被非友非己占据 */
function formationCenterCanStand(cy, cx, offsets, fSet, mapResult, battleTroops, inB) {
  return offsets.every(({ dy, dx }) => {
    const ny = cy + dy;
    const nx = cx + dx;
    if (!inB(ny, nx)) return false;
    if (getMoveCost(ny, nx, mapResult) === Infinity) return false;
    if (isHazardTile(ny, nx, mapResult)) return false;
    const occupant = battleTroops.find((bt) => bt.currentTroops > 0 && bt.y === ny && bt.x === nx);
    if (!occupant) return true;
    if (fSet.has(`${occupant.y},${occupant.x}`)) return true;
    if (occupant.faction === 'ally') return true;
    return false;
  });
}

/**
 * 阵型中心一步移到 (ny,nx) 后，各成员踏入格的最大移动力消耗
 *（与 useManualBattle 中逐格 formationGroupMove 的扣费方式一致）
 */
function formationStepMaxCost(ny, nx, offsets, mapResult, inB) {
  return Math.max(
    ...offsets.map(({ dy: oy, dx: ox }) => {
      const ty = ny + oy;
      const tx = nx + ox;
      if (!inB(ty, tx)) return Infinity;
      return getMoveCost(ty, tx, mapResult);
    }),
  );
}

function parseCenterRemKey(key) {
  const parts = String(key).split(',');
  if (parts.length < 3) return null;
  const rem = Number(parts[parts.length - 1]);
  const x = Number(parts[parts.length - 2]);
  const y = Number(parts[parts.length - 3]);
  if (!Number.isFinite(y) || !Number.isFinite(x) || !Number.isFinite(rem)) return null;
  return { y, x, rem };
}

/**
 * computeFormationReachable - 阵型整体移动可达格（中心坐标）
 */
export function computeFormationReachable(fTroops, remMove, mapResult, battleTroops) {
  if (!mapResult || remMove <= 0) return new Map();
  const alive = fTroops.filter((t) => t.currentTroops > 0);
  if (alive.length === 0) return new Map();

  const { w: mapW, h: mapH } = getMapTerrainDimensions(mapResult);
  const inB = (y, x) => y >= 0 && y < mapH && x >= 0 && x < mapW;
  const { centerY, centerX, offsets, fSet } = buildFormationFrame(alive);

  const visited = new Map();
  const queue = [{ y: centerY, x: centerX, rem: remMove }];
  visited.set(`${centerY},${centerX}`, remMove);
  const DIRS = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  while (queue.length > 0) {
    const { y, x, rem } = queue.shift();
    for (const [dy, dx] of DIRS) {
      const ny = y + dy;
      const nx = x + dx;
      if (!inB(ny, nx)) continue;
      if (!formationCenterCanStand(ny, nx, offsets, fSet, mapResult, battleTroops, inB)) continue;
      const maxCost = formationStepMaxCost(ny, nx, offsets, mapResult, inB);
      if (maxCost === Infinity) continue;
      const newRem = rem - maxCost;
      if (newRem < 0) continue;
      const key = `${ny},${nx}`;
      if (visited.has(key) && visited.get(key) >= newRem) continue;
      visited.set(key, newRem);
      queue.push({ y: ny, x: nx, rem: newRem });
    }
  }
  visited.delete(`${centerY},${centerX}`);

  return visited;
}

/**
 * 从当前中心到目标中心的一条合法路径（每步 |dy|+|dx|=1），供 handleTileClick 逐步 formationGroupMove。
 * @returns {Array<{dy:number,dx:number}>} 空数组表示已在目标；null 表示不可达
 */
export function findFormationCenterPath(fTroops, startCy, startCx, goalY, goalX, remMove, mapResult, battleTroops) {
  if (!mapResult || remMove <= 0) return null;
  const alive = fTroops.filter((t) => t.currentTroops > 0);
  if (alive.length === 0) return null;
  if (startCy === goalY && startCx === goalX) return [];

  const { w: mapW, h: mapH } = getMapTerrainDimensions(mapResult);
  const inB = (y, x) => y >= 0 && y < mapH && x >= 0 && x < mapW;
  const { centerY, centerX, offsets, fSet } = buildFormationFrame(alive);
  if (startCy !== centerY || startCx !== centerX) {
    return null;
  }

  const visited = new Set();
  const parent = new Map();
  const startKey = `${startCy},${startCx},${remMove}`;
  visited.add(startKey);
  const queue = [{ y: startCy, x: startCx, rem: remMove }];

  const DIRS = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  while (queue.length > 0) {
    const { y, x, rem } = queue.shift();
    const curKey = `${y},${x},${rem}`;
    for (const [dy, dx] of DIRS) {
      const ny = y + dy;
      const nx = x + dx;
      if (!inB(ny, nx)) continue;
      if (!formationCenterCanStand(ny, nx, offsets, fSet, mapResult, battleTroops, inB)) continue;
      const maxCost = formationStepMaxCost(ny, nx, offsets, mapResult, inB);
      if (maxCost === Infinity) continue;
      const newRem = rem - maxCost;
      if (newRem < 0) continue;
      const nextKey = `${ny},${nx},${newRem}`;
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      parent.set(nextKey, curKey);
      queue.push({ y: ny, x: nx, rem: newRem });
    }
  }

  let bestGoalKey = null;
  let bestRem = -1;
  for (const key of visited) {
    const p = parseCenterRemKey(key);
    if (!p) continue;
    if (p.y === goalY && p.x === goalX && p.rem > bestRem) {
      bestRem = p.rem;
      bestGoalKey = key;
    }
  }
  if (!bestGoalKey) return null;

  const steps = [];
  let ck = bestGoalKey;
  while (ck !== startKey) {
    const cur = parseCenterRemKey(ck);
    const pk = parent.get(ck);
    if (!cur || !pk) return null;
    const prev = parseCenterRemKey(pk);
    if (!prev) return null;
    steps.unshift({ dy: cur.y - prev.y, dx: cur.x - prev.x });
    ck = pk;
  }
  return steps;
}
