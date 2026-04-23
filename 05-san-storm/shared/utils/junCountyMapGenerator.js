/**
 * 郡大地图 · 单大象限（16×20）模拟生成：复用战役 `generateCampaignMapSimulated`，再叠加 strategic_cities、strategic_forts。
 * 与 `san_1_jun_yingchuan_quad_{A|B|C|D}.preset.json` 对齐；非战役 preset，勿写入 san_1_camp_*。
 */

import { generateCampaignMapSimulated, randomCampaignMapSeed, QUAD_ORIGIN, QUAD_W, QUAD_H } from './campaignMapGenerator.js';
import { applyYingchuanPhase1BanditPlaceholders } from './strategicBanditPlaceholderPhase1.js';
import junYingchuanQuadA from '../data/worldmap/san_1_jun_yingchuan_quad_A.preset.json' with { type: 'json' };
import junYingchuanQuadB from '../data/worldmap/san_1_jun_yingchuan_quad_B.preset.json' with { type: 'json' };
import junYingchuanQuadC from '../data/worldmap/san_1_jun_yingchuan_quad_C.preset.json' with { type: 'json' };
import junYingchuanQuadD from '../data/worldmap/san_1_jun_yingchuan_quad_D.preset.json' with { type: 'json' };

/** 小象限名 → 与战役 quad 键相同的原点 [col0, row0]（大象限 A 内）；顺时针 A1→A2→A3→A4，A3=右下 C、A4=左下 D */
const SUBQUAD_ORIGIN_IN_MAJOR_A = {
  A1: QUAD_ORIGIN.A,
  A2: QUAD_ORIGIN.B,
  A3: QUAD_ORIGIN.C,
  A4: QUAD_ORIGIN.D,
};

class SeededRandom {
  constructor(seed) {
    this._state = seed != null ? Number(seed) % 2147483647 : Math.floor(Math.random() * 2147483647);
    if (this._state <= 0) this._state += 2147483646;
  }
  next() {
    this._state = (this._state * 1664525 + 1013904223) & 0xffffffff;
    return (this._state >>> 0) / 0x100000000;
  }
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

function terrainBlocksCity(cells, col, row) {
  const cell = cells[row]?.[col];
  if (!cell) return true;
  const t = cell.terrain;
  return t === 'river' || t === 'lake';
}

function cellFreeForCityOverlay(cells, col, row) {
  if (terrainBlocksCity(cells, col, row)) return false;
  const cell = cells[row][col];
  if (cell?.object) return false;
  return true;
}

/**
 * @param {object} cells - generateCampaignMapSimulated 结果
 * @param {SeededRandom} rng
 * @param {{ city_id: string, city_name?: string, gx?: number, gy?: number, col?: number, row?: number, object?: string, sub_quad?: string }[]} cities
 * @param {boolean} randomizeInSubquad
 */
function applyStrategicCities(cells, rng, cities, randomizeInSubquad) {
  const used = new Set();

  for (const c of cities) {
    let col;
    let row;
    const obj = c.object || 'city_small';

    if (randomizeInSubquad && c.sub_quad && SUBQUAD_ORIGIN_IN_MAJOR_A[c.sub_quad]) {
      const [ox, oy] = SUBQUAD_ORIGIN_IN_MAJOR_A[c.sub_quad];
      let tries = 0;
      while (tries < 120) {
        tries += 1;
        const lx = rng.int(0, QUAD_W - 1);
        const ly = rng.int(0, QUAD_H - 1);
        const gc = ox + lx;
        const gr = oy + ly;
        const key = `${gc},${gr}`;
        if (used.has(key)) continue;
        if (!cellFreeForCityOverlay(cells, gc, gr)) continue;
        col = gc;
        row = gr;
        break;
      }
    }

    if (col == null) {
      col = c.gx != null ? c.gx : c.col;
      row = c.gy != null ? c.gy : c.row;
    }

    if (col == null || row == null) continue;
    const key = `${col},${row}`;
    if (used.has(key)) continue;
    if (!cellFreeForCityOverlay(cells, col, row)) {
      let found = false;
      for (let d = 1; d <= 3 && !found; d++) {
        for (let dy = -d; dy <= d && !found; dy++) {
          for (let dx = -d; dx <= d && !found; dx++) {
            const nc = col + dx;
            const nr = row + dy;
            const k2 = `${nc},${nr}`;
            if (used.has(k2)) continue;
            if (nc < 0 || nc >= 16 || nr < 0 || nr >= 20) continue;
            if (!cellFreeForCityOverlay(cells, nc, nr)) continue;
            col = nc;
            row = nr;
            found = true;
          }
        }
      }
      if (!cellFreeForCityOverlay(cells, col, row)) continue;
    }

    used.add(`${col},${row}`);
    cells[row][col].object = obj;
    cells[row][col].cityId = c.city_id;
    if (c.city_name) cells[row][col].cityName = c.city_name;
    cells[row][col].col = col;
    cells[row][col].row = row;
  }
}

function collectStrategicOccupiedKeys(cells) {
  const used = new Set();
  for (let r = 0; r < cells.length; r++) {
    const row = cells[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell?.cityId) used.add(`${c},${r}`);
    }
  }
  return used;
}

/**
 * Preset `strategic_forts`: fixed anchors (no randomize); same passability rules as cities.
 * @param {object} cells
 * @param {{ city_id: string, city_name?: string, gx?: number, gy?: number, col?: number, row?: number }[]} forts
 */
function applyStrategicForts(cells, forts) {
  if (!forts?.length) return;
  const used = collectStrategicOccupiedKeys(cells);

  for (const f of forts) {
    const cityId = typeof f.city_id === 'string' ? f.city_id.trim() : '';
    if (!cityId) continue;
    let col = f.gx != null ? f.gx : f.col;
    let row = f.gy != null ? f.gy : f.row;
    if (col == null || row == null) continue;

    const key = `${col},${row}`;
    if (used.has(key)) continue;
    if (!cellFreeForCityOverlay(cells, col, row)) {
      let found = false;
      for (let d = 1; d <= 3 && !found; d++) {
        for (let dy = -d; dy <= d && !found; dy++) {
          for (let dx = -d; dx <= d && !found; dx++) {
            const nc = col + dx;
            const nr = row + dy;
            const k2 = `${nc},${nr}`;
            if (used.has(k2)) continue;
            if (nc < 0 || nc >= 16 || nr < 0 || nr >= 20) continue;
            if (!cellFreeForCityOverlay(cells, nc, nr)) continue;
            col = nc;
            row = nr;
            found = true;
          }
        }
      }
      if (!cellFreeForCityOverlay(cells, col, row)) continue;
    }

    used.add(`${col},${row}`);
    cells[row][col].object = 'fort';
    cells[row][col].cityId = cityId;
    if (f.city_name) cells[row][col].cityName = f.city_name;
    cells[row][col].col = col;
    cells[row][col].row = row;
  }
}

/** 去掉仅郡 preset 持有的字段，余下与战役 generateCampaignMapSimulated 兼容 */
function stripJunOnlyFields(junPreset) {
  const {
    strategic_cities,
    strategic_forts,
    preset_kind,
    jun_quad_id,
    default_jun_id,
    sub_quad_admin,
    ...rest
  } = junPreset;
  return rest;
}

export const JUN_QUAD_PRESETS_BY_ID = {
  san_1_jun_yingchuan_quad_A: junYingchuanQuadA,
  san_1_jun_yingchuan_quad_B: junYingchuanQuadB,
  san_1_jun_yingchuan_quad_C: junYingchuanQuadC,
  san_1_jun_yingchuan_quad_D: junYingchuanQuadD,
};

/**
 * 颍川郡标准画布 32×40：四大象限左上角在郡内全局坐标 (gx, gy)。
 * 排布为「上排 A|B、下排 D|C」，与 31-5 / landmarks CSV 一致。
 * 拼接时：局部 (lc, lr) → 全局 (originGx + lc, originGy + lr)。
 */
export const SAN_1_JUN_YINGCHUAN_MAJOR_QUAD_ORIGIN = {
  A: { originGx: 0, originGy: 0 },
  B: { originGx: 16, originGy: 0 },
  C: { originGx: 16, originGy: 20 },
  D: { originGx: 0, originGy: 20 },
};

export const JUN_QUAD_PRESET_IDS = Object.keys(JUN_QUAD_PRESETS_BY_ID);

export function getJunQuadPresetById(id) {
  return JUN_QUAD_PRESETS_BY_ID[id] ?? null;
}

/**
 * @param {object} junPreset - 与 san_1_jun_yingchuan_quad_A.preset.json 同形
 * @param {{ seed?: number, randomizeCityPositions?: boolean }} options
 */
export function generateJunCountyMajorQuadSimulated(junPreset, options = {}) {
  const seed = options.seed != null ? Number(options.seed) : randomCampaignMapSeed();
  const rng = new SeededRandom((seed ^ 0x9e3779b9) >>> 0);
  const base = stripJunOnlyFields(junPreset);
  const sim = generateCampaignMapSimulated(base, { seed });
  const cities = junPreset.strategic_cities || [];
  applyStrategicCities(sim.cells, rng, cities, !!options.randomizeCityPositions);
  const forts = junPreset.strategic_forts || [];
  applyStrategicForts(sim.cells, forts);
  return {
    ...sim,
    campaignId: junPreset.campaign_id || junPreset.jun_quad_id || '',
    jun_quad_id: junPreset.jun_quad_id || null,
  };
}

export function generateJunYingchuanQuadA(options = {}) {
  return generateJunCountyMajorQuadSimulated(junYingchuanQuadA, options);
}

/** 颍川郡工具画布合并后尺寸（与 31-5 / landmarks 一致） */
export const YINGCHUAN_COUNTY_MAP_COLS = 32;
export const YINGCHUAN_COUNTY_MAP_ROWS = 40;

const YINGCHUAN_MERGE_QUAD_ORDER = [
  { presetId: 'san_1_jun_yingchuan_quad_A', majorKey: 'A' },
  { presetId: 'san_1_jun_yingchuan_quad_B', majorKey: 'B' },
  { presetId: 'san_1_jun_yingchuan_quad_C', majorKey: 'C' },
  { presetId: 'san_1_jun_yingchuan_quad_D', majorKey: 'D' },
];

function deepCloneCell(cell) {
  if (cell == null) return null;
  try {
    return structuredClone(cell);
  } catch {
    return JSON.parse(JSON.stringify(cell));
  }
}

function emptyCountyCell(gx, gy) {
  return {
    base: 'plain_grassland',
    terrain: null,
    object: null,
    effect: null,
    quad: 'A',
    col: gx,
    row: gy,
  };
}

/**
 * 四象限 preset → 单张郡画布 32×40（先合成再测；底板四块可相同 seed 下重复，仅城/据点坐标按全局对齐）。
 * @param {{ seed?: number, randomizeCityPositions?: boolean }} options
 */
export function generateYingchuanCountyMergedSimulated(options = {}) {
  const W = YINGCHUAN_COUNTY_MAP_COLS;
  const H = YINGCHUAN_COUNTY_MAP_ROWS;
  const seed =
    options.seed != null
      ? Number(options.seed)
      : Number(junYingchuanQuadA.seed) || randomCampaignMapSeed();

  const merged = Array.from({ length: H }, () => Array.from({ length: W }, () => null));

  for (const { presetId, majorKey } of YINGCHUAN_MERGE_QUAD_ORDER) {
    const preset = JUN_QUAD_PRESETS_BY_ID[presetId];
    if (!preset) continue;
    const { originGx, originGy } = SAN_1_JUN_YINGCHUAN_MAJOR_QUAD_ORIGIN[majorKey];
    const sim = generateJunCountyMajorQuadSimulated(preset, {
      seed,
      randomizeCityPositions: !!options.randomizeCityPositions,
    });
    const cells = sim.cells;
    for (let lr = 0; lr < cells.length; lr++) {
      const row = cells[lr];
      if (!row) continue;
      for (let lc = 0; lc < row.length; lc++) {
        const gx = originGx + lc;
        const gy = originGy + lr;
        const raw = row[lc];
        const cell = raw ? deepCloneCell(raw) : null;
        if (cell) {
          cell.col = gx;
          cell.row = gy;
        }
        merged[gy][gx] = cell;
      }
    }
  }

  for (let gy = 0; gy < H; gy++) {
    for (let gx = 0; gx < W; gx++) {
      if (merged[gy][gx] == null) merged[gy][gx] = emptyCountyCell(gx, gy);
    }
  }

  applyYingchuanPhase1BanditPlaceholders(merged, seed);

  return {
    cells: merged,
    seed,
    mapColumns: W,
    mapRows: H,
    campaignId: 'san_1_jun_yingchuan_county_merged',
  };
}

export { randomCampaignMapSeed } from './campaignMapGenerator.js';
