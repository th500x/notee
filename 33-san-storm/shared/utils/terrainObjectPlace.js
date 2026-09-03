/**
 * 战术图对象瓦排布（树林 / 山丘 / 桥）— mapGenerator_v2 · P3
 * 须与 terrainObjectPlace.cjs 同步。
 *
 * 素材约定（tile_2_terrain/）：
 * - forest_01.png 约 90×56：横跨 **2×1** 格（两枚 64×64）
 * - forest_02.png 约 50×92：纵跨 **1×2** 格
 * - hill_01/02.png **32×32**：同一 64×64 格内叠放，**最多 3** 枚
 * - bridge_01.png 横桥（跨南北向河）；bridge_02.png 竖桥（跨东西向河）
 *
 * @see docs/01-strategic-world/30-frontend/31-7-MAP_GENERATOR_V2_IMPLEMENTATION.md
 */

import { TERRAIN_OCC } from './terrainWangTables.js';

/** 对象瓦相对 assets/san_1_map/ */
export const TERRAIN_OBJECT_DIR = 'tile_2_terrain';

/** 单格山丘叠章上限（超过易糊） */
export const HILL_STAMPS_PER_CELL_MAX = 3;

/** 河格数大于此值才尝试放桥（水格 4～6 → 一座） */
export const BRIDGE_MIN_RIVER_CELLS = 3;

/** 河格数大于此值时尝试放第二座桥（水格 >6 → 两座） */
export const BRIDGE_DUAL_MIN_RIVER_CELLS = 6;

/** 两座桥中点曼哈顿距离下限（避免贴在一起） */
export const BRIDGE_PAIR_MIN_SEPARATION = 3;

/** 桥距地图外缘至少空出的格数（靠边无意义） */
export const BRIDGE_EDGE_MARGIN = 1;

/** @typedef {{ id: string, spanW: number, spanH: number, tileRel: string }} ForestVariantDef */

export const FOREST_VARIANT_DEFS = Object.freeze([
  Object.freeze({
    id: '01',
    spanW: 2,
    spanH: 1,
    tileRel: `${TERRAIN_OBJECT_DIR}/forest_01.png`,
  }),
  Object.freeze({
    id: '02',
    spanW: 1,
    spanH: 2,
    tileRel: `${TERRAIN_OBJECT_DIR}/forest_02.png`,
  }),
]);

export const HILL_VARIANT_IDS = Object.freeze(['01', '02']);

/** @typedef {'ew'|'ns'} BridgeOrient — ew=横桥(01) 跨南北河；ns=竖桥(02) 跨东西河 */

export const BRIDGE_DEFS = Object.freeze({
  ew: Object.freeze({
    orient: 'ew',
    variant: '01',
    tileRel: `${TERRAIN_OBJECT_DIR}/bridge_01.png`,
  }),
  ns: Object.freeze({
    orient: 'ns',
    variant: '02',
    tileRel: `${TERRAIN_OBJECT_DIR}/bridge_02.png`,
  }),
});

/**
 * @param {string} id
 * @returns {string}
 */
export function hillTileRel(id) {
  const n = String(id).padStart(2, '0');
  return `${TERRAIN_OBJECT_DIR}/hill_${n}.png`;
}

/**
 * @param {string[][]} occupancy
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function isGrassCell(occupancy, x, y) {
  const row = occupancy[y];
  return Array.isArray(row) && row[x] === TERRAIN_OCC.GRASS;
}

function isWaterCell(occupancy, x, y) {
  const row = occupancy[y];
  return Array.isArray(row) && row[x] === TERRAIN_OCC.WATER;
}

function inBounds(x, y, w, h) {
  return x >= 0 && y >= 0 && x < w && y < h;
}

/** 沿方向走出水面后是否落到非熔岩陆地（可作桥岸） */
function hasBankBeyond(occupancy, x, y, dx, dy, width, height) {
  for (let step = 1; step <= 4; step += 1) {
    const nx = x + dx * step;
    const ny = y + dy * step;
    if (!inBounds(nx, ny, width, height)) return false;
    const cell = occupancy[ny][nx];
    if (cell === TERRAIN_OCC.WATER) continue;
    if (cell === TERRAIN_OCC.LAVA) return false;
    return true;
  }
  return false;
}

/** 同行连续水带（河宽，东西向量） */
function measureWaterRunEW(occupancy, x, y) {
  let x0 = x;
  let x1 = x;
  while (isWaterCell(occupancy, x0 - 1, y)) x0 -= 1;
  while (isWaterCell(occupancy, x1 + 1, y)) x1 += 1;
  /** @type {Array<{ x: number, y: number }>} */
  const cells = [];
  for (let cx = x0; cx <= x1; cx += 1) cells.push({ x: cx, y });
  return { x0, x1, span: cells.length, cells };
}

/** 同列连续水带（河宽，南北向量） */
function measureWaterRunNS(occupancy, x, y) {
  let y0 = y;
  let y1 = y;
  while (isWaterCell(occupancy, x, y0 - 1)) y0 -= 1;
  while (isWaterCell(occupancy, x, y1 + 1)) y1 += 1;
  /** @type {Array<{ x: number, y: number }>} */
  const cells = [];
  for (let cy = y0; cy <= y1; cy += 1) cells.push({ x, y: cy });
  return { y0, y1, span: cells.length, cells };
}

/**
 * 统计水格；河长（格数）> BRIDGE_MIN_RIVER_CELLS 才放桥。
 * @param {string[][]} occupancy
 * @returns {number}
 */
export function countWaterCells(occupancy) {
  let n = 0;
  for (const row of occupancy) {
    for (const c of row) if (c === TERRAIN_OCC.WATER) n += 1;
  }
  return n;
}

/**
 * @param {Array<{x:number,y:number}>} cells
 * @returns {string}
 */
function bridgeCellsKey(cells) {
  return cells
    .map((c) => `${c.x},${c.y}`)
    .sort()
    .join('|');
}

/**
 * @param {Array<{x:number,y:number}>} cells
 * @returns {{ x: number, y: number }}
 */
function bridgeMidpoint(cells) {
  if (!cells?.length) return { x: 0, y: 0 };
  return cells[Math.floor(cells.length / 2)] || cells[0];
}

/**
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 */
function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * @param {Array<{x:number,y:number}>} a
 * @param {Array<{x:number,y:number}>} b
 */
function bridgeCellsOverlap(a, b) {
  const set = new Set(a.map((c) => `${c.x},${c.y}`));
  return b.some((c) => set.has(`${c.x},${c.y}`));
}

/**
 * 收集可架桥候选（按河宽水带去重）。
 * @returns {Array<{ x: number, y: number, orient: BridgeOrient, cells: Array<{x:number,y:number}> }>}
 */
function collectBridgeCandidates(occupancy, width, height, margin) {
  /** @type {Array<{ x: number, y: number, orient: BridgeOrient, cells: Array<{x:number,y:number}> }>} */
  const candidates = [];
  const seen = new Set();

  const tryPush = (x, y, orient, cells) => {
    const onEdge = cells.some(
      (c) => c.x < margin || c.x >= width - margin || c.y < margin || c.y >= height - margin,
    );
    if (onEdge) return;
    const key = `${orient}:${bridgeCellsKey(cells)}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ x, y, orient, cells });
  };

  for (let y = margin; y < height - margin; y += 1) {
    for (let x = margin; x < width - margin; x += 1) {
      if (!isWaterCell(occupancy, x, y)) continue;
      const runEw = measureWaterRunEW(occupancy, x, y);
      const runNs = measureWaterRunNS(occupancy, x, y);
      const canEw =
        hasBankBeyond(occupancy, x, y, -1, 0, width, height) &&
        hasBankBeyond(occupancy, x, y, 1, 0, width, height);
      const canNs =
        hasBankBeyond(occupancy, x, y, 0, -1, width, height) &&
        hasBankBeyond(occupancy, x, y, 0, 1, width, height);

      /** @type {BridgeOrient|null} */
      let orient = null;
      if (canEw && canNs) {
        orient = runEw.span <= runNs.span ? 'ew' : 'ns';
      } else if (canEw) {
        orient = 'ew';
      } else if (canNs) {
        orient = 'ns';
      }
      if (!orient) continue;
      const cells = orient === 'ew' ? runEw.cells : runNs.cells;
      tryPush(x, y, orient, cells);
    }
  }

  // 无合格两岸候选时：非边缘水格，仍按较短水带定朝向
  if (candidates.length === 0) {
    for (let y = margin; y < height - margin; y += 1) {
      for (let x = margin; x < width - margin; x += 1) {
        if (!isWaterCell(occupancy, x, y)) continue;
        const runEw = measureWaterRunEW(occupancy, x, y);
        const runNs = measureWaterRunNS(occupancy, x, y);
        const orient = runEw.span <= runNs.span ? 'ew' : 'ns';
        const cells = orient === 'ew' ? runEw.cells : runNs.cells;
        tryPush(x, y, orient, cells);
      }
    }
  }

  return candidates;
}

/**
 * @param {{ x:number, y:number, orient: BridgeOrient, cells: Array<{x:number,y:number}> }} pick
 */
function buildBridgeOverlay(pick) {
  const def = BRIDGE_DEFS[pick.orient];
  const cells = pick.cells.map((c) => ({ x: c.x, y: c.y }));
  const mid = bridgeMidpoint(cells);
  return {
    type: 'bridge',
    orient: pick.orient,
    variant: def.variant,
    x: mid.x,
    y: mid.y,
    tileRel: def.tileRel,
    /** 河宽每一格一块桥（渲染时各自缩进 64×64） */
    cells,
  };
}

/**
 * 在河上放桥：河宽 N 格 → N 块相连桥瓦。
 * 水格 4～6（>3 且 ≤6）一座；水格 >6 尝试两座且中点拉开。
 * @returns {{
 *   bridges: Array<{ type: 'bridge', orient: BridgeOrient, variant: string, x: number, y: number, tileRel: string, cells: Array<{x:number,y:number}> }>,
 *   bridge: object | null,
 *   waterCount: number,
 * }}
 */
export function placeRiverBridge(options) {
  const occupancy = options?.occupancy;
  const rng = options?.rng;
  if (!Array.isArray(occupancy) || !rng) {
    throw new Error('[terrainObjectPlace] placeRiverBridge needs occupancy+rng');
  }
  const height = occupancy.length;
  const width = occupancy[0]?.length ?? 0;
  const waterCount = countWaterCells(occupancy);
  const minCells = Math.max(0, Math.floor(Number(options?.minRiverCells ?? BRIDGE_MIN_RIVER_CELLS)));
  const dualMin = Math.max(
    minCells + 1,
    Math.floor(Number(options?.dualMinRiverCells ?? BRIDGE_DUAL_MIN_RIVER_CELLS)),
  );
  const minSep = Math.max(
    1,
    Math.floor(Number(options?.pairMinSeparation ?? BRIDGE_PAIR_MIN_SEPARATION)),
  );

  if (waterCount <= minCells || options?.enabled === false) {
    return { bridges: [], bridge: null, waterCount };
  }

  const margin = Math.max(1, Math.floor(Number(options?.edgeMargin ?? BRIDGE_EDGE_MARGIN)));
  const candidates = collectBridgeCandidates(occupancy, width, height, margin);
  if (candidates.length === 0) {
    return { bridges: [], bridge: null, waterCount };
  }

  const targetCount = waterCount > dualMin ? 2 : 1;
  /** @type {typeof candidates} */
  const pool = candidates.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  /** @type {ReturnType<typeof buildBridgeOverlay>[]} */
  const bridges = [];
  const first = pool[0];
  bridges.push(buildBridgeOverlay(first));

  if (targetCount >= 2 && pool.length > 1) {
    const mid1 = bridgeMidpoint(first.cells);
    let best = null;
    let bestDist = -1;
    for (let i = 1; i < pool.length; i += 1) {
      const cand = pool[i];
      if (bridgeCellsOverlap(first.cells, cand.cells)) continue;
      const dist = manhattan(mid1, bridgeMidpoint(cand.cells));
      if (dist < minSep) continue;
      if (dist > bestDist) {
        bestDist = dist;
        best = cand;
      }
    }
    // 没有满足间距的：退而求最远且不重叠（仍尽量拉开）
    if (!best) {
      for (let i = 1; i < pool.length; i += 1) {
        const cand = pool[i];
        if (bridgeCellsOverlap(first.cells, cand.cells)) continue;
        const dist = manhattan(mid1, bridgeMidpoint(cand.cells));
        if (dist > bestDist) {
          bestDist = dist;
          best = cand;
        }
      }
    }
    if (best) bridges.push(buildBridgeOverlay(best));
  }

  return {
    bridges,
    bridge: bridges[0] || null,
    waterCount,
  };
}

/**
 * footprint 内是否均可放林（草、未占用）
 * @param {string[][]} occupancy
 * @param {boolean[][]} blocked
 * @param {number} x
 * @param {number} y
 * @param {number} spanW
 * @param {number} spanH
 */
function canPlaceFootprint(occupancy, blocked, x, y, spanW, spanH) {
  const h = occupancy.length;
  const w = occupancy[0]?.length ?? 0;
  if (x < 0 || y < 0 || x + spanW > w || y + spanH > h) return false;
  for (let dy = 0; dy < spanH; dy += 1) {
    for (let dx = 0; dx < spanW; dx += 1) {
      const cx = x + dx;
      const cy = y + dy;
      if (!isGrassCell(occupancy, cx, cy)) return false;
      if (blocked[cy][cx]) return false;
    }
  }
  return true;
}

function markFootprint(blocked, x, y, spanW, spanH) {
  for (let dy = 0; dy < spanH; dy += 1) {
    for (let dx = 0; dx < spanW; dx += 1) {
      blocked[y + dy][x + dx] = true;
    }
  }
}

/**
 * 放置对象瓦。优先级：**桥（功能）→ 树林 → 山丘**（林/丘避让桥格及四邻）。
 *
 * @param {object} options
 * @param {string[][]} options.occupancy
 * @param {{ next: () => number, int: (max: number) => number, pick: (arr: any[]) => any }} options.rng
 * @param {{ enabled?: boolean, targetCount?: number }} [options.forest]
 * @param {{ enabled?: boolean, cellCount?: number, stampsPerCellMin?: number, stampsPerCellMax?: number }} [options.hill]
 * @param {object|false} [options.bridge]  false=关闭；水格>3 放桥；水格>6 尝试两座
 * @returns {{
 *   forests: Array<{ type: 'forest', variant: string, x: number, y: number, spanW: number, spanH: number, tileRel: string }>,
 *   hills: Array<{ type: 'hill', x: number, y: number, stamps: Array<{ variant: string, ox: number, oy: number, tileRel: string }> }>,
 *   bridge: object|null,
 *   bridges: object[],
 *   blocked: boolean[][],
 * }}
 */
export function placeTerrainObjects(options) {
  const occupancy = options?.occupancy;
  if (!Array.isArray(occupancy) || occupancy.length === 0) {
    throw new Error('[terrainObjectPlace] occupancy empty');
  }
  const height = occupancy.length;
  const width = occupancy[0]?.length ?? 0;
  if (width <= 0) throw new Error('[terrainObjectPlace] occupancy width 0');
  for (let y = 0; y < height; y += 1) {
    if (!Array.isArray(occupancy[y]) || occupancy[y].length !== width) {
      throw new Error(`[terrainObjectPlace] ragged row ${y}`);
    }
  }
  const rng = options?.rng;
  if (!rng || typeof rng.next !== 'function' || typeof rng.int !== 'function') {
    throw new Error('[terrainObjectPlace] rng required');
  }

  /** @type {boolean[][]} */
  const blocked = Array.from({ length: height }, () => Array(width).fill(false));
  /** @type {Array<{ type: 'forest', variant: string, x: number, y: number, spanW: number, spanH: number, tileRel: string }>} */
  const forests = [];
  /** @type {Array<{ type: 'hill', x: number, y: number, stamps: Array<{ variant: string, ox: number, oy: number, tileRel: string }> }>} */
  const hills = [];

  // ── 1. 桥（重要功能性对象，优先于树林/山丘）──────────────────────────
  const bridgeOpt = options?.bridge;
  /** @type {object[]} */
  let bridges = [];
  if (bridgeOpt !== false) {
    const placedBridge = placeRiverBridge({
      occupancy,
      rng,
      enabled: bridgeOpt?.enabled !== false,
      minRiverCells: bridgeOpt?.minRiverCells,
      dualMinRiverCells: bridgeOpt?.dualMinRiverCells,
      pairMinSeparation: bridgeOpt?.pairMinSeparation,
      edgeMargin: bridgeOpt?.edgeMargin,
    });
    bridges = placedBridge.bridges || [];
    for (const br of bridges) {
      for (const c of br.cells || []) {
        if (c.y >= 0 && c.y < height && c.x >= 0 && c.x < width) {
          blocked[c.y][c.x] = true;
        }
      }
    }
  }
  const bridge = bridges[0] || null;

  /** 足迹是否碰到桥格或其四邻（避免林戳视觉盖住桥） */
  function footprintConflictsWithBridge(x, y, spanW, spanH) {
    if (!bridges.length) return false;
    const bridgeSet = new Set();
    for (const br of bridges) {
      for (const c of br.cells || []) bridgeSet.add(`${c.x},${c.y}`);
    }
    for (let dy = 0; dy < spanH; dy += 1) {
      for (let dx = 0; dx < spanW; dx += 1) {
        const cx = x + dx;
        const cy = y + dy;
        for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (bridgeSet.has(`${cx + ox},${cy + oy}`)) return true;
        }
      }
    }
    return false;
  }

  // ── 2. 树林（普通装饰，避让桥）──────────────────────────────────────
  const forestOpt = options?.forest;
  if (forestOpt?.enabled !== false) {
    const area = width * height;
    const target =
      forestOpt?.targetCount != null
        ? Math.max(0, Math.floor(Number(forestOpt.targetCount)))
        : Math.max(2, Math.floor(area * 0.06));
    let attempts = 0;
    const maxAttempts = Math.max(40, target * 25);
    while (forests.length < target && attempts < maxAttempts) {
      attempts += 1;
      const def = rng.pick(FOREST_VARIANT_DEFS);
      const x = rng.int(width);
      const y = rng.int(height);
      if (!canPlaceFootprint(occupancy, blocked, x, y, def.spanW, def.spanH)) continue;
      if (footprintConflictsWithBridge(x, y, def.spanW, def.spanH)) continue;
      markFootprint(blocked, x, y, def.spanW, def.spanH);
      forests.push({
        type: 'forest',
        variant: def.id,
        x,
        y,
        spanW: def.spanW,
        spanH: def.spanH,
        tileRel: def.tileRel,
      });
    }
  }

  // ── 3. 山丘（普通装饰，避让桥与林）──────────────────────────────────
  const hillOpt = options?.hill;
  if (hillOpt?.enabled !== false) {
    const area = width * height;
    const cellTarget =
      hillOpt?.cellCount != null
        ? Math.max(0, Math.floor(Number(hillOpt.cellCount)))
        : Math.max(2, Math.floor(area * 0.08));
    const stampMin = Math.max(1, Math.floor(Number(hillOpt?.stampsPerCellMin ?? 2)));
    const stampMaxRaw = Math.floor(Number(hillOpt?.stampsPerCellMax ?? HILL_STAMPS_PER_CELL_MAX));
    const stampMax = Math.min(
      HILL_STAMPS_PER_CELL_MAX,
      Math.max(stampMin, stampMaxRaw),
    );

    /** @type {{ x: number, y: number }[]} */
    const candidates = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (isGrassCell(occupancy, x, y) && !blocked[y][x]) candidates.push({ x, y });
      }
    }
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = rng.int(i + 1);
      const tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }
    const take = Math.min(cellTarget, candidates.length);
    for (let i = 0; i < take; i += 1) {
      const { x, y } = candidates[i];
      if (footprintConflictsWithBridge(x, y, 1, 1)) continue;
      blocked[y][x] = true;
      const stampCount = stampMin + rng.int(stampMax - stampMin + 1);
      /** @type {Array<{ variant: string, ox: number, oy: number, tileRel: string }>} */
      const stamps = [];
      for (let s = 0; s < stampCount; s += 1) {
        const variant = rng.pick([...HILL_VARIANT_IDS]);
        const ox = rng.next() * 0.5;
        const oy = rng.next() * 0.5;
        stamps.push({
          variant,
          ox,
          oy,
          tileRel: hillTileRel(variant),
        });
      }
      hills.push({ type: 'hill', x, y, stamps });
    }
  }

  return { forests, hills, bridge, bridges, blocked };
}

/**
 * 将对象瓦写入玩法用 terrain 格网（不改 occupancy）。
 * water→river，lava→lava；树林 footprint→forest；山丘格→hill。
 *
 * @param {string[][]} occupancy
 * @param {{ forests?: Array<{ x: number, y: number, spanW: number, spanH: number }>, hills?: Array<{ x: number, y: number }>, bridge?: { cells?: Array<{x:number,y:number}> }|null, bridges?: Array<{ cells?: Array<{x:number,y:number}> }> }} overlays
 * @returns {string[][]}
 */
export function buildGameplayTerrainFromOccupancy(occupancy, overlays) {
  const height = occupancy.length;
  const width = occupancy[0].length;
  /** @type {string[][]} */
  const terrain = [];
  for (let y = 0; y < height; y += 1) {
    terrain[y] = [];
    for (let x = 0; x < width; x += 1) {
      const occ = occupancy[y][x];
      if (occ === TERRAIN_OCC.WATER) terrain[y][x] = 'river';
      else if (occ === TERRAIN_OCC.LAVA) terrain[y][x] = 'lava';
      else terrain[y][x] = 'plain';
    }
  }
  for (const f of overlays?.forests || []) {
    for (let dy = 0; dy < f.spanH; dy += 1) {
      for (let dx = 0; dx < f.spanW; dx += 1) {
        const cx = f.x + dx;
        const cy = f.y + dy;
        if (terrain[cy]?.[cx] === 'plain') terrain[cy][cx] = 'forest';
      }
    }
  }
  for (const h of overlays?.hills || []) {
    if (terrain[h.y]?.[h.x] === 'plain') terrain[h.y][h.x] = 'hill';
  }
  const bridgeList =
    overlays?.bridges?.length
      ? overlays.bridges
      : overlays?.bridge
        ? [overlays.bridge]
        : [];
  for (const br of bridgeList) {
    for (const c of br?.cells || []) {
      if (terrain[c.y]?.[c.x] === 'river') terrain[c.y][c.x] = 'bridge';
    }
  }
  return terrain;
}
