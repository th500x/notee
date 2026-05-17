/**
 * S1 豫州战略：从 `public/data/worldmap/*_merged.json` 加载颍川 + 汝南垂直栈（与 `StrategicWorldMapSection` 同源）。
 * 纯异步、无 React；`baseUrl` 由调用方传入（Vite：`import.meta.env.BASE_URL`）。
 */

import {
  generateYingchuanCountyMergedSimulated,
  YINGCHUAN_COUNTY_MAP_COLS,
  YINGCHUAN_COUNTY_MAP_ROWS,
} from './junCountyMapGenerator.js';
import { ensureYingchuanMergedMapCells } from './strategicBanditPlaceholderPhase1.js';
import { buildSan1YuVerticalStackFromMergedPayloads } from './strategicWorldMapStack.js';

export function normalizeMergedMapSeed(data) {
  if (!data || typeof data !== 'object') return 0;
  if (data.seed != null && data.seed !== '') {
    const n = Number(data.seed);
    return Number.isFinite(n) ? n : 0;
  }
  if (data.version != null && data.version !== '') {
    const n = Number(data.version);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * @param {{ baseUrl: string }} p - 如 `import.meta.env.BASE_URL`，须以 `/` 结尾或与相对路径拼接一致
 * @returns {Promise<{ ok: true, cells: object[][], seed: number, version: unknown, mapColumns: number, mapRows: number, junId: string, season: string, roadCells: Array<{gx:number,gy:number}>, roadConnectivity: '4'|'8' } | { ok: false, error: string }>}
 */
export async function loadSan1StrategicMergedStackFromPublic({ baseUrl }) {
  const root = String(baseUrl || '').replace(/\/?$/, '/');
  const fetchJunMerged = async (jid) => {
    const rel = `data/worldmap/${encodeURIComponent(jid)}_merged.json`;
    const res = await fetch(`${root}${rel}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  };

  let topJson = null;
  try {
    topJson = await fetchJunMerged('san_1_jun_yingchuan');
  } catch {
    topJson = null;
  }
  if (!topJson?.cells?.length) {
    const fb = generateYingchuanCountyMergedSimulated({});
    topJson = {
      cells: fb.cells,
      seed: fb.seed,
      version: null,
      mapColumns: fb.mapColumns ?? YINGCHUAN_COUNTY_MAP_COLS,
      mapRows: fb.mapRows ?? YINGCHUAN_COUNTY_MAP_ROWS,
      junId: 'san_1_jun_yingchuan',
      season: 'san_1',
      roadCells: null,
      roadConnectivity: '4',
    };
  } else {
    const seedTop = normalizeMergedMapSeed(topJson);
    topJson = {
      ...topJson,
      cells: ensureYingchuanMergedMapCells(topJson.cells, seedTop, {
        roadCells: Array.isArray(topJson.roadCells) ? topJson.roadCells : null,
        mapColumns: topJson.mapColumns ?? YINGCHUAN_COUNTY_MAP_COLS,
        mapRows: topJson.mapRows ?? YINGCHUAN_COUNTY_MAP_ROWS,
      }),
    };
  }

  let bottomJson = null;
  try {
    bottomJson = await fetchJunMerged('san_1_jun_runan');
  } catch {
    bottomJson = null;
  }

  const stack = buildSan1YuVerticalStackFromMergedPayloads({
    yingchuan: topJson,
    runan: bottomJson,
  });
  if (!stack.ok) {
    return { ok: false, error: stack.error || 'stack failed' };
  }

  const seed = normalizeMergedMapSeed(topJson);
  return {
    ok: true,
    cells: stack.cells,
    seed,
    version: topJson.version,
    mapColumns: stack.mapColumns,
    mapRows: stack.mapRows,
    junId: 'san_1_strategic_stack_yu',
    season: stack.season,
    roadCells: stack.roadCells,
    roadConnectivity: stack.roadConnectivity,
  };
}
