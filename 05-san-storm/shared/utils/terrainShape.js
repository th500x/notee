/**
 * 战术底图 Shape：尺寸无关 occupancy 生成（mapGenerator_v2 · P2）
 * 须与 terrainShape.cjs 同步。
 *
 * 绘制顺序：base → grass 斑 → river(water) → lava。
 * 启用河时水格必须 4-连通，否则抛错（禁止静默断河）。
 *
 * @see docs/01-strategic-world/30-frontend/31-7-MAP_GENERATOR_V2_IMPLEMENTATION.md
 */

import { TERRAIN_OCC } from './terrainWangTables.js';

const { VOID, GRASS, WATER, LAVA } = TERRAIN_OCC;

/** @typedef {'void'|'grass'|'water'|'lava'} TerrainOccupancy */
/** @typedef {'ns'|'ew'|'L'|'meander'|'auto'} RiverStyle */
/** @typedef {'south'|'north'|'east'|'west'|'auto'} LavaRegion */

/**
 * 与 mapGenerator / campaign 同构的简单 LCG
 * @param {number} [seed]
 */
export function createTerrainShapeRng(seed) {
  let state = seed != null ? Number(seed) % 2147483647 : Math.floor(Math.random() * 2147483647);
  if (state <= 0) state += 2147483646;
  return {
    /** @returns {number} [0,1) */
    next() {
      state = (state * 1664525 + 1013904223) & 0xffffffff;
      return (state >>> 0) / 0x100000000;
    },
    /** @param {number} max exclusive */
    int(max) {
      const m = Math.max(0, Math.floor(max));
      if (m <= 0) return 0;
      return Math.floor(this.next() * m);
    },
    pick(arr) {
      if (!arr.length) throw new Error('[terrainShape] pick empty');
      return arr[this.int(arr.length)];
    },
  };
}

/**
 * @param {number} width
 * @param {number} height
 * @param {TerrainOccupancy} fill
 * @returns {TerrainOccupancy[][]}
 */
export function createOccupancyGrid(width, height, fill = VOID) {
  const w = Math.floor(Number(width));
  const h = Math.floor(Number(height));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 2 || h < 2) {
    throw new Error(`[terrainShape] invalid size ${width}×${height} (min 2×2)`);
  }
  if (w > 128 || h > 128) {
    throw new Error(`[terrainShape] size ${w}×${h} exceeds 128 (refuse runaway)`);
  }
  /** @type {TerrainOccupancy[][]} */
  const grid = [];
  for (let y = 0; y < h; y += 1) {
    grid[y] = [];
    for (let x = 0; x < w; x += 1) grid[y][x] = fill;
  }
  return grid;
}

/**
 * @param {{ x: number, y: number, w: number, h: number }[]} rects
 * @param {number} width
 * @param {number} height
 * @returns {boolean[][]}
 */
function buildReservedMask(rects, width, height) {
  /** @type {boolean[][]} */
  const mask = Array.from({ length: height }, () => Array(width).fill(false));
  if (!Array.isArray(rects)) return mask;
  for (const r of rects) {
    const x0 = Math.floor(Number(r?.x));
    const y0 = Math.floor(Number(r?.y));
    const rw = Math.floor(Number(r?.w));
    const rh = Math.floor(Number(r?.h));
    if (![x0, y0, rw, rh].every((n) => Number.isFinite(n)) || rw <= 0 || rh <= 0) {
      throw new Error(`[terrainShape] invalid reservedRect ${JSON.stringify(r)}`);
    }
    for (let y = y0; y < y0 + rh; y += 1) {
      for (let x = x0; x < x0 + rw; x += 1) {
        if (y >= 0 && x >= 0 && y < height && x < width) mask[y][x] = true;
      }
    }
  }
  return mask;
}

function inBounds(x, y, w, h) {
  return x >= 0 && y >= 0 && x < w && y < h;
}

/**
 * 水格 4-连通校验；无水格视为未启用河（ok）
 * @param {TerrainOccupancy[][]} grid
 * @returns {{ ok: true, count: number } | { ok: false, count: number, reason: string }}
 */
export function checkWaterConnectivity(grid) {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  /** @type {[number, number][]} */
  const cells = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (grid[y][x] === WATER) cells.push([x, y]);
    }
  }
  if (cells.length === 0) return { ok: true, count: 0 };
  const key = (x, y) => `${x},${y}`;
  const want = new Set(cells.map(([x, y]) => key(x, y)));
  const seen = new Set();
  const q = [cells[0]];
  seen.add(key(cells[0][0], cells[0][1]));
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  while (q.length) {
    const [cx, cy] = q.pop();
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      const k = key(nx, ny);
      if (!want.has(k) || seen.has(k)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  if (seen.size !== want.size) {
    return {
      ok: false,
      count: cells.length,
      reason: `water not 4-connected (component ${seen.size}/${want.size})`,
    };
  }
  return { ok: true, count: cells.length };
}

/**
 * @param {TerrainOccupancy[][]} grid
 * @param {boolean[][]} reserved
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1 inclusive
 * @param {number} y1 inclusive
 * @param {TerrainOccupancy} kind
 * @returns {number} painted
 */
function paintRect(grid, reserved, x0, y0, x1, y1, kind) {
  const h = grid.length;
  const w = grid[0].length;
  let n = 0;
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) {
      if (!inBounds(x, y, w, h) || reserved[y][x]) continue;
      grid[y][x] = kind;
      n += 1;
    }
  }
  return n;
}

/**
 * 蜿蜒河（meander）：沿主轴前进并夹 1～2 次侧移；Shape 厚固定 1 → Wang 补齐后表意「河宽 2」。
 * @returns {number} painted cells this call (approx via paintRect returns)
 */
function paintMeanderRiver(grid, reserved, rng) {
  const h = grid.length;
  const w = grid[0].length;
  const t = 1; // 固定 Shape 厚 1
  if (w < 4 || h < 4) {
    throw new Error('[terrainShape] size too small for meander river');
  }
  const axis = rng.pick(['ns', 'ew']);
  let painted = 0;

  if (axis === 'ns') {
    // 南北流：逐行画，在约 1/3、2/3 处侧移（拐角行加宽保证 4-连通）
    let x = Math.max(1, Math.min(w - t - 1, Math.floor(w / 2) + rng.int(3) - 1));
    const bendYs = [];
    if (h >= 6) bendYs.push(Math.floor(h / 3));
    if (h >= 9) bendYs.push(Math.floor((2 * h) / 3));
    for (let y = 0; y < h; y += 1) {
      painted += paintRect(grid, reserved, x, y, x + t - 1, y, WATER);
      if (bendYs.includes(y)) {
        const dir = rng.pick([-1, 1]);
        const nx = Math.max(0, Math.min(w - t, x + dir));
        if (nx !== x) {
          painted += paintRect(grid, reserved, Math.min(x, nx), y, Math.max(x, nx) + t - 1, y, WATER);
          x = nx;
        }
      }
    }
  } else {
    // 东西流：逐列画，在约 1/3、2/3 处上下侧移
    let y = Math.max(1, Math.min(h - t - 1, Math.floor(h / 2) + rng.int(3) - 1));
    const bendXs = [];
    if (w >= 6) bendXs.push(Math.floor(w / 3));
    if (w >= 9) bendXs.push(Math.floor((2 * w) / 3));
    for (let x = 0; x < w; x += 1) {
      painted += paintRect(grid, reserved, x, y, x, y + t - 1, WATER);
      if (bendXs.includes(x)) {
        const dir = rng.pick([-1, 1]);
        const ny = Math.max(0, Math.min(h - t, y + dir));
        if (ny !== y) {
          painted += paintRect(grid, reserved, x, Math.min(y, ny), x, Math.max(y, ny) + t - 1, WATER);
          y = ny;
        }
      }
    }
  }
  return painted;
}

/**
 * @param {object} opts
 * @param {TerrainOccupancy[][]} opts.grid
 * @param {boolean[][]} opts.reserved
 * @param {ReturnType<typeof createTerrainShapeRng>} opts.rng
 * @param {RiverStyle} opts.style
 * @param {number} opts.thickness
 */
function paintRiver(opts) {
  const { grid, reserved, rng, style: styleIn, thickness: thickIn } = opts;
  const h = grid.length;
  const w = grid[0].length;
  /** @type {RiverStyle} */
  let style = styleIn === 'auto' ? rng.pick(['ns', 'ew', 'L', 'meander']) : styleIn;
  if (!['ns', 'ew', 'L', 'meander'].includes(style)) {
    throw new Error(`[terrainShape] invalid river.style=${styleIn}`);
  }

  // meander 固定 Shape 厚 1（表意河宽 2）；其它样式仍用调用方 thickness
  const thickness =
    style === 'meander' ? 1 : Math.max(1, Math.min(3, Math.floor(Number(thickIn) || 2)));

  let painted = 0;
  if (style === 'ns') {
    if (w < thickness + 1) throw new Error('[terrainShape] width too small for ns river');
    const maxStart = w - thickness;
    const jitter = rng.int(Math.min(3, maxStart + 1));
    const x0 = Math.max(0, Math.min(maxStart, Math.floor((w - thickness) / 2) + jitter - 1));
    painted += paintRect(grid, reserved, x0, 0, x0 + thickness - 1, h - 1, WATER);
  } else if (style === 'ew') {
    if (h < thickness + 1) throw new Error('[terrainShape] height too small for ew river');
    const maxStart = h - thickness;
    const jitter = rng.int(Math.min(3, maxStart + 1));
    const y0 = Math.max(0, Math.min(maxStart, Math.floor((h - thickness) / 2) + jitter - 1));
    painted += paintRect(grid, reserved, 0, y0, w - 1, y0 + thickness - 1, WATER);
  } else if (style === 'L') {
    // L：竖段靠左中 + 横段靠下中，共享拐角保证连通
    if (w < thickness + 2 || h < thickness + 2) {
      throw new Error('[terrainShape] size too small for L river');
    }
    const vx = Math.max(1, Math.min(w - thickness - 1, Math.floor(w * 0.3) + rng.int(2)));
    const hy = Math.max(thickness, Math.min(h - thickness - 1, Math.floor(h * 0.65) + rng.int(2)));
    painted += paintRect(grid, reserved, vx, 1, vx + thickness - 1, hy + thickness - 1, WATER);
    painted += paintRect(grid, reserved, vx, hy, w - 2, hy + thickness - 1, WATER);
  } else {
    painted += paintMeanderRiver(grid, reserved, rng);
  }

  if (painted === 0) {
    throw new Error(`[terrainShape] river style=${style} painted 0 cells (reserved blocking?)`);
  }
  const conn = checkWaterConnectivity(grid);
  if (!conn.ok) {
    throw new Error(`[terrainShape] ${conn.reason}`);
  }
  return { style, thickness, waterCells: conn.count };
}

/**
 * 斑块生长（避开 reserved 与已是 water/lava）
 * @param {object} p
 */
function growBlobs(p) {
  const { grid, reserved, rng, kind, targetCount, maxSeeds } = p;
  const h = grid.length;
  const w = grid[0].length;
  /** @type {[number, number][]} */
  const candidates = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (reserved[y][x]) continue;
      const cur = grid[y][x];
      if (cur === WATER || cur === LAVA) continue;
      if (kind === GRASS && cur === GRASS) continue;
      candidates.push([x, y]);
    }
  }
  if (candidates.length === 0 || targetCount <= 0) return 0;

  const seeds = Math.max(1, Math.min(maxSeeds, Math.ceil(targetCount / 8)));
  /** @type {[number, number][]} */
  const frontier = [];
  for (let i = 0; i < seeds && candidates.length; i += 1) {
    const idx = rng.int(candidates.length);
    const [x, y] = candidates.splice(idx, 1)[0];
    grid[y][x] = kind;
    frontier.push([x, y]);
  }
  let painted = frontier.length;
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  while (painted < targetCount && frontier.length) {
    const fi = rng.int(frontier.length);
    const [cx, cy] = frontier[fi];
    /** @type {[number, number][]} */
    const opts = [];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny, w, h) || reserved[ny][nx]) continue;
      const cur = grid[ny][nx];
      if (cur === WATER || cur === LAVA || cur === kind) continue;
      opts.push([nx, ny]);
    }
    if (!opts.length) {
      frontier.splice(fi, 1);
      continue;
    }
    const [nx, ny] = rng.pick(opts);
    grid[ny][nx] = kind;
    frontier.push([nx, ny]);
    painted += 1;
  }
  return painted;
}

/**
 * @param {object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {number} [options.seed]
 * @param {'void'|'grass'} [options.base]
 * @param {{ enabled?: boolean, style?: RiverStyle, thickness?: number }} [options.river]
 * @param {{ coverage?: number, blobCount?: number }} [options.grass]
 * @param {{ enabled?: boolean, region?: LavaRegion, coverage?: number }} [options.lava]
 * @param {{ x: number, y: number, w: number, h: number }[]} [options.reservedRects]
 * @returns {{
 *   width: number,
 *   height: number,
 *   seed: number,
 *   occupancy: TerrainOccupancy[][],
 *   meta: object,
 * }}
 */
export function generateTerrainOccupancy(options) {
  const width = Math.floor(Number(options?.width));
  const height = Math.floor(Number(options?.height));
  const seedRaw = options?.seed;
  const seed =
    seedRaw != null && Number.isFinite(Number(seedRaw))
      ? Number(seedRaw)
      : Math.floor(Math.random() * 2147483646) + 1;
  const base = options?.base === GRASS ? GRASS : VOID;
  const rng = createTerrainShapeRng(seed);
  const grid = createOccupancyGrid(width, height, base);
  const reserved = buildReservedMask(options?.reservedRects || [], width, height);

  const meta = {
    base,
    river: null,
    grassPainted: 0,
    lavaPainted: 0,
  };

  // grass 斑：base=void 时按 coverage 生长；base=grass 时可选再补斑（默认跳过）
  const grassOpt = options?.grass;
  if (grassOpt && base === VOID) {
    const coverage = Math.min(0.85, Math.max(0, Number(grassOpt.coverage ?? 0.35)));
    const target = Math.floor(width * height * coverage);
    const blobCount = Math.max(1, Math.floor(Number(grassOpt.blobCount) || 3));
    meta.grassPainted = growBlobs({
      grid,
      reserved,
      rng,
      kind: GRASS,
      targetCount: target,
      maxSeeds: blobCount,
    });
  }

  const riverOpt = options?.river;
  if (riverOpt?.enabled) {
    meta.river = paintRiver({
      grid,
      reserved,
      rng,
      style: riverOpt.style || 'auto',
      thickness: riverOpt.thickness ?? 2,
    });
  }

  const lavaOpt = options?.lava;
  if (lavaOpt?.enabled) {
    let region = lavaOpt.region || 'south';
    if (region === 'auto') region = rng.pick(['south', 'north']);
    const coverage = Math.min(0.4, Math.max(0.05, Number(lavaOpt.coverage ?? 0.12)));
    // 区域加权：只在半图内取种子
    /** @type {boolean[][]} */
    const regionMask = Array.from({ length: height }, () => Array(width).fill(false));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let ok = false;
        if (region === 'south') ok = y >= Math.floor(height * 0.55);
        else if (region === 'north') ok = y < Math.floor(height * 0.45);
        else if (region === 'east') ok = x >= Math.floor(width * 0.55);
        else if (region === 'west') ok = x < Math.floor(width * 0.45);
        regionMask[y][x] = ok;
      }
    }
    // 临时把区外标成 reserved 语义：复制 reserved 并 OR 非区
    /** @type {boolean[][]} */
    const lavaReserved = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => reserved[y][x] || !regionMask[y][x]),
    );
    const target = Math.floor(width * height * coverage);
    meta.lavaPainted = growBlobs({
      grid,
      reserved: lavaReserved,
      rng,
      kind: LAVA,
      targetCount: target,
      maxSeeds: 2,
    });
    if (meta.lavaPainted === 0) {
      throw new Error(`[terrainShape] lava enabled but painted 0 (size/region/reserved)`);
    }
  }

  // 最终再验河
  if (riverOpt?.enabled) {
    const conn = checkWaterConnectivity(grid);
    if (!conn.ok) throw new Error(`[terrainShape] after lava: ${conn.reason}`);
    if (conn.count === 0) throw new Error('[terrainShape] river enabled but no water cells');
  }

  return {
    width,
    height,
    seed,
    occupancy: grid,
    meta,
  };
}

export { TERRAIN_OCC };
