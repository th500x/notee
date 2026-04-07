/**
 * computeFormationReachable - 阵型整体移动可达格计算
 *
 * 纯函数：无副作用，可在 useCallback 外复用与单元测试。
 *
 * 算法：
 *   1. 以存活部队坐标均值为中心点，计算各部队相对中心的偏移。
 *   2. 对中心点做 BFS（不检查部队占据，阵型内部互不阻挡）。
 *   3. 过滤：中心移到目标格后，所有偏移格都必须在地图范围内、
 *      地形可通行、且未被非阵型部队占据。
 *
 * @param {object[]} fTroops      阵型部队列表
 * @param {number}   remMove      剩余移动力
 * @param {object}   mapResult    战役/战斗地图数据（含 terrain, objects, meta）
 * @param {object[]} battleTroops 当前所有部队（用于排除占据格）
 * @returns {Map<string, number>}  key: "y,x"，value: 到达该格后剩余移动力
 */
import { getMoveCost } from '@/systems/battleFlowManager';
import { getMapTerrainDimensions } from '@shared/utils/tacticalBattleGrid';

export function computeFormationReachable(fTroops, remMove, mapResult, battleTroops) {
  if (!mapResult || remMove <= 0) return new Map();
  const alive = fTroops.filter((t) => t.currentTroops > 0);
  if (alive.length === 0) return new Map();

  const { w: mapW, h: mapH } = getMapTerrainDimensions(mapResult);
  const inB = (y, x) => y >= 0 && y < mapH && x >= 0 && x < mapW;

  const centerY = Math.round(alive.reduce((s, t) => s + t.y, 0) / alive.length);
  const centerX = Math.round(alive.reduce((s, t) => s + t.x, 0) / alive.length);

  const offsets = alive.map((t) => ({ dy: t.y - centerY, dx: t.x - centerX }));
  const fSet = new Set(alive.map((t) => `${t.y},${t.x}`));

  // BFS：只对中心点检查地形通行性
  const visited = new Map();
  const queue = [{ y: centerY, x: centerX, rem: remMove }];
  visited.set(`${centerY},${centerX}`, remMove);
  const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  while (queue.length > 0) {
    const { y, x, rem } = queue.shift();
    for (const [dy, dx] of DIRS) {
      const ny = y + dy, nx = x + dx;
      if (!inB(ny, nx)) continue;
      // 用所有部队偏移格的最大移动消耗（与 handleTileClick 实际移动逻辑一致）
      const maxCost = Math.max(...offsets.map(({ dy: oy, dx: ox }) => {
        const ty = ny + oy, tx = nx + ox;
        if (!inB(ty, tx)) return Infinity;
        return getMoveCost(ty, tx, mapResult);
      }));
      if (maxCost === Infinity) continue;
      const newRem = rem - maxCost;
      if (newRem < 0) continue;
      const key = `${ny},${nx}`;
      if (visited.has(key) && visited.get(key) >= newRem) continue;
      visited.set(key, newRem);
      queue.push({ y: ny, x: nx, rem: newRem });
    }
  }
  visited.delete(`${centerY},${centerX}`); // 移除起点本身

  // DEV：首步四方向诊断（仅开发环境输出，不影响生产）
  if (import.meta.env.DEV) {
    const dirNames = { '0,1': 'right', '0,-1': 'left', '1,0': 'down(back)', '-1,0': 'up(fwd)' };
    for (const [dy, dx] of DIRS) {
      const ny = centerY + dy, nx = centerX + dx;
      const label = dirNames[`${dy},${dx}`] || `${dy},${dx}`;
      if (!inB(ny, nx)) { console.warn(`[formationReachable] ${label}: center ${ny},${nx} OOB`); continue; }
      const details = offsets.map(({ dy: oy, dx: ox }, i) => {
        const ty = ny + oy, tx = nx + ox;
        if (!inB(ty, tx)) return { i, pos: `${ty},${tx}`, reason: 'OOB' };
        const cost = getMoveCost(ty, tx, mapResult);
        if (cost === Infinity) return { i, pos: `${ty},${tx}`, reason: 'impassable', terrain: mapResult?.terrain?.[ty]?.[tx], obj: mapResult?.objects?.find(o => o.y === ty && o.x === tx)?.type };
        return { i, pos: `${ty},${tx}`, cost };
      });
      const maxCost = Math.max(...details.map(d => d.reason ? Infinity : d.cost));
      const blocked = details.filter(d => d.reason);
      console.warn(`[formationReachable] ${label}: maxCost=${maxCost}, remAfter=${remMove - maxCost}`, blocked.length ? { blocked } : '(all passable)');
    }
    console.warn('[formationReachable] center=', centerY, centerX, 'remMove=', remMove, 'offsets=', offsets, 'BFS visited=', visited.size);
  }

  // 过滤：检查所有偏移格的合法性（友军可通行，敌军阻挡）
  const validReachable = new Map();
  for (const [key, remaining] of visited) {
    const [cy, cx] = key.split(',').map(Number);
    const allValid = offsets.every(({ dy, dx }) => {
      const ny = cy + dy, nx = cx + dx;
      if (!inB(ny, nx)) return false;
      if (getMoveCost(ny, nx, mapResult) === Infinity) return false;
      const occupant = battleTroops.find((bt) => bt.currentTroops > 0 && bt.y === ny && bt.x === nx);
      if (!occupant) return true;
      if (fSet.has(`${occupant.y},${occupant.x}`)) return true;
      if (occupant.faction === 'ally') return true;
      return false;
    });
    if (allValid) validReachable.set(key, remaining);
  }

  if (import.meta.env.DEV) {
    console.warn('[formationReachable] final reachable centers:', validReachable.size);
  }
  return validReachable;
}
