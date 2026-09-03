/**
 * S1 豫州战略：从 `public/data/worldmap/*_merged.json` 加载颍川（+ 就绪时叠汝南 L 形）。
 * 纯异步、无 React；`baseUrl` 由调用方传入（Vite：`import.meta.env.BASE_URL`）。
 *
 * - 缺颍川 merged：早失败（禁止回退旧 32×40 仿真图）
 * - 邻郡未 Meowa/工坊就绪（含 temporary_crop）：不叠入世界图、不进 playableJunIds
 */

import { ensureYingchuanMergedMapCells } from './strategicBanditPlaceholderPhase1.js';
import { buildSan1YuVerticalStackFromMergedPayloads } from './strategicWorldMapStack.js';
import {
  isJunStrategicMapPlayReady,
  junMeowaPreviewPublicUrl,
} from './junStrategicMapReadiness.js';

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
 * @param {{ baseUrl: string }} p
 */
export async function loadSan1StrategicMergedStackFromPublic({ baseUrl }) {
  const root = String(baseUrl || '').replace(/\/?$/, '/');
  const fetchJunMerged = async (jid) => {
    const rel = `data/worldmap/${encodeURIComponent(jid)}_merged.json`;
    const res = await fetch(`${root}${rel}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${jid} HTTP ${res.status}`);
    return res.json();
  };

  let topJson = null;
  try {
    topJson = await fetchJunMerged('san_1_jun_yingchuan');
  } catch (e) {
    return {
      ok: false,
      error: `缺少颍川合并图 public/data/worldmap/san_1_jun_yingchuan_merged.json（${e?.message || e}）`,
    };
  }
  if (!topJson?.cells?.length || !Array.isArray(topJson.cells[0])) {
    return { ok: false, error: '颍川合并图无效（缺 cells）' };
  }

  const mapColumns = Number(topJson.mapColumns);
  const mapRows = Number(topJson.mapRows);
  if (!Number.isFinite(mapColumns) || !Number.isFinite(mapRows) || mapColumns <= 0 || mapRows <= 0) {
    return { ok: false, error: '颍川合并图缺少有效 mapColumns/mapRows' };
  }

  const seedTop = normalizeMergedMapSeed(topJson);
  topJson = {
    ...topJson,
    mapColumns,
    mapRows,
    cells: ensureYingchuanMergedMapCells(topJson.cells, seedTop, {
      roadCells: Array.isArray(topJson.roadCells) ? topJson.roadCells : null,
      mapColumns,
      mapRows,
    }),
  };

  // TEMP 2026-07：系统暂不启用汝南郡 —— 注释叠图拉取，仅颍川（勿删，恢复时解开）
  let bottomJson = null;
  // try {
  //   bottomJson = await fetchJunMerged('san_1_jun_runan');
  // } catch {
  //   bottomJson = null;
  // }

  const yingchuanReady = isJunStrategicMapPlayReady(topJson);
  // const runanReady = isJunStrategicMapPlayReady(bottomJson);
  /** 未正式生成的邻郡不参与叠图（避免 VOID/临时裁图进游玩视口） */
  // const runanForStack = runanReady ? bottomJson : null;
  const runanForStack = null; // TEMP：汝南暂不叠入

  // if (bottomJson && !runanReady) {
  //   console.info(
  //     '[san1StrategicMergedPublicLoader] 汝南 merged 未就绪（非 Meowa/工坊），不叠入大地图',
  //     { source: bottomJson.source?.kind || null },
  //   );
  // }

  const stack = buildSan1YuVerticalStackFromMergedPayloads({
    yingchuan: topJson,
    runan: runanForStack,
  });
  if (!stack.ok) {
    return { ok: false, error: stack.error || 'stack failed' };
  }

  const seed = normalizeMergedMapSeed(topJson);
  const mode = stack.mode || 'single_county';
  const junId =
    mode === 'l_stack' || mode === 'vertical_stack'
      ? 'san_1_strategic_stack_yu'
      : 'san_1_jun_yingchuan';

  const playableJunIds = [];
  const junVisuals = {};
  if (yingchuanReady) {
    playableJunIds.push('san_1_jun_yingchuan');
    junVisuals.san_1_jun_yingchuan = {
      kind: 'meowa_local_pack',
      previewUrl: junMeowaPreviewPublicUrl(root, 'san_1_jun_yingchuan'),
      visualRef: topJson.visualRef || null,
    };
  }
  // TEMP 2026-07：汝南暂不进 playableJunIds（与上方 runanForStack=null 成对）
  // if (runanReady) {
  //   playableJunIds.push('san_1_jun_runan');
  //   junVisuals.san_1_jun_runan = {
  //     kind: 'meowa_local_pack',
  //     previewUrl: junMeowaPreviewPublicUrl(root, 'san_1_jun_runan'),
  //     visualRef: bottomJson.visualRef || null,
  //   };
  // }

  /** 单郡 Meowa：整幅底板；L 形时仅覆盖颍川矩形（见网格 underlay） */
  const meowaUnderlays = [];
  if (yingchuanReady && junVisuals.san_1_jun_yingchuan?.previewUrl) {
    if (mode === 'l_stack') {
      meowaUnderlays.push({
        junId: 'san_1_jun_yingchuan',
        url: junVisuals.san_1_jun_yingchuan.previewUrl,
        col0: 0,
        row0: 0,
        cols: Number(topJson.mapColumns) || 16,
        rows: Number(topJson.mapRows) || 40,
      });
    } else {
      meowaUnderlays.push({
        junId: 'san_1_jun_yingchuan',
        url: junVisuals.san_1_jun_yingchuan.previewUrl,
        col0: 0,
        row0: 0,
        cols: stack.mapColumns,
        rows: stack.mapRows,
      });
    }
  }

  return {
    ok: true,
    cells: stack.cells,
    seed,
    version: topJson.version,
    mapColumns: stack.mapColumns,
    mapRows: stack.mapRows,
    junId,
    season: stack.season,
    roadCells: stack.roadCells,
    roadConnectivity: stack.roadConnectivity,
    mode,
    includedJunIds: Array.isArray(stack.includedJunIds) ? stack.includedJunIds : ['san_1_jun_yingchuan'],
    playableJunIds,
    junVisuals,
    meowaUnderlays,
    widthMismatch: !!stack.widthMismatch,
  };
}
