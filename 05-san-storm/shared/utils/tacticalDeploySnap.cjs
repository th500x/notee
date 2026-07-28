/**
 * 战术部署落点：避开河/湖/熔岩与不可通行障碍，落到最近可部署格。
 * 须与 tacticalDeploySnap.js 同步。
 *
 * 禁止：无地图时当「全可部署」；找不到格时静默回退到河上首选格。
 */

const { ZONE } = require('./tacticalBattleGrid.js');

function isTacticalCellDeployable(y, x, mapResult) {
  if (!mapResult?.terrain?.length || !mapResult.terrain[0]?.length) return false;
  const height = mapResult.terrain.length;
  const width = mapResult.terrain[0].length;
  if (y < 0 || x < 0 || y >= height || x >= width) return false;
  const t = mapResult.terrain[y][x];
  if (t === 'river' || t === 'lake' || t === 'lava') return false;
  const obj = (mapResult.objects || []).find((o) => o.y === y && o.x === x);
  if (obj && obj.isPassable === false) return false;
  return true;
}

function sideRowOk(preferredY, height) {
  if (ZONE.deployA.includes(preferredY)) {
    return (y) => ZONE.deployA.includes(y);
  }
  if (ZONE.deployB.includes(preferredY)) {
    return (y) => ZONE.deployB.includes(y);
  }
  if (preferredY <= 2) return (y) => y <= Math.min(3, height - 1);
  if (preferredY >= height - 3) return (y) => y >= Math.max(0, height - 4);
  return () => true;
}

function findNearestDeployableCell(sy, sx, mapResult, occupied = new Set()) {
  if (!mapResult?.terrain?.length || !mapResult.terrain[0]?.length) return null;
  const height = mapResult.terrain.length;
  const width = mapResult.terrain[0].length;
  const rowOk = sideRowOk(sy, height);
  const maxR = Math.max(height, width);
  for (let r = 0; r <= maxR; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (r > 0 && Math.abs(dy) !== r && Math.abs(dx) !== r) continue;
        const y = sy + dy;
        const x = sx + dx;
        if (!rowOk(y)) continue;
        const k = `${y},${x}`;
        if (occupied.has(k)) continue;
        if (isTacticalCellDeployable(y, x, mapResult)) return { y, x };
      }
    }
  }
  return null;
}

function snapDeployPositions(preferredList, mapResult, opts = {}) {
  if (!mapResult?.terrain?.length) {
    throw new Error(
      `[snapDeployPositions] ${opts.label || 'deploy'} 缺少 mapResult.terrain：不可在无地图时落子（会导致部队站河）`,
    );
  }
  const occupied = new Set(opts.occupied || []);
  const out = [];
  for (const pref of preferredList || []) {
    const snapped = findNearestDeployableCell(pref.y, pref.x, mapResult, occupied);
    if (!snapped) {
      throw new Error(
        `[snapDeployPositions] ${opts.label || 'deploy'} 无法在本侧部署带为 (${pref.y},${pref.x}) 找到非河/熔岩格`,
      );
    }
    if (!isTacticalCellDeployable(snapped.y, snapped.x, mapResult)) {
      throw new Error(
        `[snapDeployPositions] 内部错误：吸附结果仍不可部署 (${snapped.y},${snapped.x})`,
      );
    }
    occupied.add(`${snapped.y},${snapped.x}`);
    out.push(snapped);
  }
  return out;
}

function assertTroopsNotOnUndeployableTerrain(troops, mapResult) {
  for (const t of troops || []) {
    if ((t.currentTroops ?? 1) <= 0) continue;
    if (!isTacticalCellDeployable(t.y, t.x, mapResult)) {
      const cell = mapResult?.terrain?.[t.y]?.[t.x];
      throw new Error(
        `[deploy] 部队 ${t.id || '?'} 落在不可部署格 (${t.y},${t.x}) terrain=${cell}`,
      );
    }
  }
}

module.exports = {
  isTacticalCellDeployable,
  findNearestDeployableCell,
  snapDeployPositions,
  assertTroopsNotOnUndeployableTerrain,
};
