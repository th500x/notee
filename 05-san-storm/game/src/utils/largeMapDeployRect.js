/**
 * 大型战术图（LargeMap）玩家部署区判定。
 * 部署矩形由生图给出（`mapSim.deployRects.player`），本模块只做落位可行性与枚举。
 */

export function isCellInDeployRect(col, row, rect) {
  return (
    col >= rect.colMin &&
    col <= rect.colMax &&
    row >= rect.rowMin &&
    row <= rect.rowMax
  );
}

/** 不可部署在河/湖/占用对象格 */
export function isCellDeployableForPlayer(cell) {
  if (!cell) return false;
  const t = cell.terrain;
  if (t === 'river' || t === 'lake') return false;
  if (cell.object) return false;
  return true;
}

/**
 * 自北向南、自西向东枚举可部署格（先最前排，部署靠近前线）
 * @param {Array<Array<object>>} cells
 */
export function listPassableDeployCellsInRect(cells, rect) {
  const out = [];
  for (let row = rect.rowMin; row <= rect.rowMax; row++) {
    for (let col = rect.colMin; col <= rect.colMax; col++) {
      const c = cells[row]?.[col];
      if (isCellDeployableForPlayer(c)) out.push({ col, row });
    }
  }
  return out;
}
