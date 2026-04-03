/**
 * 象限内可通行格的最大四连通块（非河、非湖）。
 * 用于部队与功能性对象（塔/栅/军营）：仅底板与地形可被河流/边缘「切断」成小孤岛；
 * 游戏逻辑层须落在大陆块上，避免仅靠地图边一格连通的观感。
 */

const QUAD_W = 8;
const QUAD_H = 10;

const QUAD_ORIGIN = {
  A: [0, 0],
  B: [8, 0],
  C: [8, 10],
  D: [0, 10],
};

function localIndexToXY(li) {
  return { x: li % QUAD_W, y: Math.floor(li / QUAD_W) };
}

function quadIndexToGlobal(quadKey, localIndex) {
  const [ox, oy] = QUAD_ORIGIN[quadKey];
  const { x, y } = localIndexToXY(localIndex);
  return { col: ox + x, row: oy + y };
}

function neighbors4Local(li) {
  const { x, y } = localIndexToXY(li);
  const out = [];
  if (x > 0) out.push(li - 1);
  if (x < QUAD_W - 1) out.push(li + 1);
  if (y > 0) out.push(li - QUAD_W);
  if (y < QUAD_H - 1) out.push(li + QUAD_W);
  return out;
}

function terrainBlocksMovement(t) {
  return t === 'river' || t === 'lake';
}

/**
 * @param {object[][]} cells
 * @param {'A'|'B'|'C'|'D'} quadKey
 * @returns {Set<number>} 象限内线性格索引
 */
export function computeLargestPassableComponentLocal(cells, quadKey) {
  const passable = new Set();
  for (let li = 0; li < 80; li++) {
    const { col, row } = quadIndexToGlobal(quadKey, li);
    if (!terrainBlocksMovement(cells[row][col].terrain)) passable.add(li);
  }

  const visited = new Set();
  let bestComp = new Set();
  const centerLi = 3 + 4 * QUAD_W;

  for (let start = 0; start < 80; start++) {
    if (!passable.has(start) || visited.has(start)) continue;
    const comp = new Set();
    const q = [start];
    visited.add(start);
    comp.add(start);
    while (q.length) {
      const cur = q.shift();
      for (const nb of neighbors4Local(cur)) {
        if (!passable.has(nb) || visited.has(nb)) continue;
        visited.add(nb);
        comp.add(nb);
        q.push(nb);
      }
    }
    if (
      comp.size > bestComp.size ||
      (comp.size === bestComp.size && comp.has(centerLi) && !bestComp.has(centerLi))
    ) {
      bestComp = comp;
    }
  }

  return bestComp;
}
