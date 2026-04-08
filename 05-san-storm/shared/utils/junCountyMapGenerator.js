/**
 * 郡大地图 · 单大象限（16×20）模拟生成：复用战役 `generateCampaignMapSimulated`，再叠加 strategic_cities。
 * 与 `san_1_jun_yingchuan_quad_A.preset.json` 等对齐；非战役 preset，勿写入 san_1_camp_*。
 */

import { generateCampaignMapSimulated, randomCampaignMapSeed, QUAD_ORIGIN, QUAD_W, QUAD_H } from './campaignMapGenerator.js';
import junYingchuanQuadA from '../data/worldmap/san_1_jun_yingchuan_quad_A.preset.json';

/** 小象限名 → 与战役 quad 键相同的原点 [col0, row0]（大象限 A 内） */
const SUBQUAD_ORIGIN_IN_MAJOR_A = {
  A1: QUAD_ORIGIN.A,
  A2: QUAD_ORIGIN.B,
  A3: QUAD_ORIGIN.D,
  A4: QUAD_ORIGIN.C,
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
  }
}

/** 去掉仅郡 preset 持有的字段，余下与战役 generateCampaignMapSimulated 兼容 */
function stripJunOnlyFields(junPreset) {
  const { strategic_cities, preset_kind, jun_quad_id, ...rest } = junPreset;
  return rest;
}

export const JUN_QUAD_PRESETS_BY_ID = {
  san_1_jun_yingchuan_quad_A: junYingchuanQuadA,
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
  return {
    ...sim,
    campaignId: junPreset.campaign_id || junPreset.jun_quad_id || '',
    jun_quad_id: junPreset.jun_quad_id || null,
  };
}

export function generateJunYingchuanQuadA(options = {}) {
  return generateJunCountyMajorQuadSimulated(junYingchuanQuadA, options);
}

export { randomCampaignMapSeed } from './campaignMapGenerator.js';
