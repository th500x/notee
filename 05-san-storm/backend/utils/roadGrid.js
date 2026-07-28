/**
 * 郡内道路栅格权威源（02 §2.1.2（5）、01 §3.2.24）。
 *
 * 优先级：
 *   1. MySQL 中已为该 season+junId 入库的道路数据（若迁移 / 管理端已写入专用表，
 *      以实装表名为准；目前仓内尚未建立独立表，本函数在无数据时回退 merged.json）。
 *   2. public/data/worldmap/{jun}_merged.json（与工坊写出、31-2 一致）。
 *
 * 同一业务请求只采用一种来源完成全部校验，禁止半套混用。
 *
 * 返回结构：
 *   {
 *     source: 'db' | 'json' | 'none',
 *     cells: Map<"gx,gy", true>,                 // 道路可通行集合
 *     blocked: Set<"gx,gy">,                      // 2×2 战略对象占格（道路不得落入）
 *     mapColumns: number,
 *     mapRows: number,
 *   }
 */

const fs = require('fs');
const path = require('path');
const {
  normalizeRoadCellList,
  buildStrategicObjectFootprintBlockedSet,
} = require('../../shared/utils/strategicRoadOverlay.js');
const { ensureYingchuanMergedMapCells } = require('../../shared/utils/strategicBanditPlaceholderPhase1.js');
const { isJunStrategicMapPlayReady } = require('../../shared/utils/junStrategicMapReadiness.cjs');

/** S1 豫州大地图垂直叠放郡（与 `shared/utils/strategicWorldMapStack.js` 一致） */
const SAN_1_YU_STACK_JUN_IDS = ['san_1_jun_yingchuan', 'san_1_jun_runan'];

const SHARED_WORLDMAP_PUBLIC_DIR = path.join(__dirname, '../../public/data/worldmap');

function mergedJsonFilename(junId) {
  return `san_1_jun_${String(junId || '').replace(/^san_1_jun_/, '')}_merged.json`;
}

/**
 * 读取郡的 merged.json（缺失返回 null）。
 * @param {string} junId
 */
function readMergedJson(junId) {
  const bare = String(junId || '').replace(/^san_1_jun_/, '');
  if (!bare) return null;
  const filename = `san_1_jun_${bare}_merged.json`;
  const fp = path.join(SHARED_WORLDMAP_PUBLIC_DIR, filename);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (_) {
    return null;
  }
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function neighborOffsets4() {
  return [
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
}

/**
 * @param {string} season
 * @param {string} junId
 */
function isSan1YuStackRoadJunId(junId) {
  const j = String(junId || '').trim();
  return SAN_1_YU_STACK_JUN_IDS.includes(j);
}

/**
 * 颍川 + 汝南垂直叠放道路权威栅格（世界行 `gy` 与前端 `StrategicWorldMapSection` 一致）。
 * @param {string} [_season] 预留与 DB 道路表对齐；现仅从磁盘 merged 构造
 * @returns {Promise<object|null>} 与 `loadRoadGrid` 同形字段 + `isSan1YuVerticalStack: true`
 */
async function loadRoadGridSan1YuVerticalStack(_season) {
  let stackMod;
  try {
    stackMod = await import('../../shared/utils/strategicWorldMapStack.js');
  } catch (e) {
    console.error('[roadGrid] loadRoadGridSan1YuVerticalStack import', e);
    return null;
  }
  const top = readMergedJson('san_1_jun_yingchuan');
  if (!top?.cells?.length || !Array.isArray(top.cells[0])) return null;
  const mapColumns = Number(top.columns || top.mapColumns);
  if (!Number.isFinite(mapColumns) || mapColumns <= 0) return null;
  const mapRowsSlice = Math.min(40, Number(top.mapRows) || 40, top.cells.length);
  const mergedSeed = Number(top.seed);
  const topJunBare = String(top.junId || 'san_1_jun_yingchuan').replace(/^san_1_jun_/, '');
  const terrainCellsTop =
    topJunBare === 'yingchuan'
      ? ensureYingchuanMergedMapCells(top.cells, Number.isFinite(mergedSeed) ? mergedSeed : 0, {
          roadCells: Array.isArray(top.roadCells) ? top.roadCells : null,
          mapColumns,
          mapRows: mapRowsSlice,
        })
      : top.cells;
  const topAdj = { ...top, cells: terrainCellsTop, mapColumns, mapRows: mapRowsSlice };
  // TEMP 2026-07：系统暂不启用汝南郡 —— 道路栅格仅颍川（与 san1StrategicMergedPublicLoader 成对；勿删）
  // const bottomRaw = readMergedJson('san_1_jun_runan');
  // const bottom =
  //   bottomRaw && bottomRaw.cells?.length && isJunStrategicMapPlayReady(bottomRaw)
  //     ? bottomRaw
  //     : null;
  // if (bottomRaw && !bottom) {
  //   console.info(
  //     '[roadGrid] 汝南 merged 未就绪（非 Meowa/工坊），道路栅格仅颍川',
  //     { source: bottomRaw.source?.kind || null },
  //   );
  // }
  const bottom = null;
  const built = stackMod.buildSan1YuVerticalStackFromMergedPayloads({
    yingchuan: topAdj,
    runan: bottom,
  });
  if (!built?.ok || !built.cells?.length) return null;
  const road = normalizeRoadCellList(built.roadCells);
  const cells = new Map();
  for (const { gx, gy } of road) cells.set(cellKey(gx, gy), true);
  const blocked = buildStrategicObjectFootprintBlockedSet(built.cells, built.mapColumns, built.mapRows);
  const stacked = built.mode === 'vertical_stack' || built.mode === 'l_stack';
  const included =
    Array.isArray(built.includedJunIds) && built.includedJunIds.length
      ? built.includedJunIds
      : ['san_1_jun_yingchuan'];
  return {
    source: 'json',
    cells,
    blocked,
    mapColumns: built.mapColumns,
    mapRows: built.mapRows,
    rawCells: built.cells,
    roadCellsRaw: built.roadCells || [],
    /** L 形 / 旧垂直叠图：世界行坐标；单郡 false */
    isSan1YuVerticalStack: stacked,
    stackJunIds: included,
    stackMode: built.mode || 'single_county',
    widthMismatch: !!built.widthMismatch,
  };
}

async function loadRoadGrid(season, junId) {
  const json = readMergedJson(junId);
  if (!json || !Array.isArray(json.cells) || !Array.isArray(json.roadCells)) {
    return {
      source: 'none',
      cells: new Map(),
      blocked: new Set(),
      mapColumns: 0,
      mapRows: 0,
      roadCellsRaw: [],
    };
  }
  const mapColumns = Number(json.columns || json.mapColumns || 0);
  const mapRows = Number(json.rows || json.mapRows || 0);
  const road = normalizeRoadCellList(json.roadCells);
  const cells = new Map();
  for (const { gx, gy } of road) cells.set(cellKey(gx, gy), true);
  const bareJun = String(junId || '').replace(/^san_1_jun_/, '');
  const mergedSeed = Number(json.seed);
  const terrainCells =
    bareJun === 'yingchuan'
      ? ensureYingchuanMergedMapCells(json.cells, Number.isFinite(mergedSeed) ? mergedSeed : 0, {
          roadCells: Array.isArray(json.roadCells) ? json.roadCells : null,
          mapColumns,
          mapRows,
        })
      : json.cells;
  const blocked = buildStrategicObjectFootprintBlockedSet(terrainCells, mapColumns, mapRows);
  return {
    source: 'json',
    cells,
    blocked,
    mapColumns,
    mapRows,
    rawCells: terrainCells,
    roadCellsRaw: Array.isArray(json.roadCells) ? json.roadCells : [],
  };
}

/**
 * 以 `cells` 二维表找到 main_city_id 所在的战略城块锚点（2×2 优先），
 * 返回该块占据的全部格集合。用于判断「无 road_position 时首跳必须邻接主城块」。
 */
const OBJECT_2X2 = new Set(['city_small', 'city_medium', 'city_major', 'city_gate']);

function cellIs2x2CityObject(objectType) {
  return objectType && OBJECT_2X2.has(String(objectType));
}

/**
 * 与前端 `findStrategicCityAnchorForMainCity` 一致：先 2×2 锚点，再 1×1。
 */
function findMainCityFootprint(cells, mainCityId, mapColumns, mapRows) {
  if (!Array.isArray(cells) || !mainCityId) return new Set();
  const target = String(mainCityId);
  const buildFootprint = (r, c, is2x2) => {
    const out = new Set();
    if (is2x2) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const x = c + dx;
          const y = r + dy;
          if (x < mapColumns && y < mapRows) out.add(cellKey(x, y));
        }
      }
    } else {
      out.add(cellKey(c, r));
    }
    return out;
  };
  for (let r = 0; r < mapRows; r++) {
    const row = cells[r];
    if (!row) continue;
    for (let c = 0; c < mapColumns; c++) {
      const cell = row[c];
      if (!cell?.cityId || String(cell.cityId) !== target) continue;
      if (cellIs2x2CityObject(cell.object)) return buildFootprint(r, c, true);
    }
  }
  for (let r = 0; r < mapRows; r++) {
    const row = cells[r];
    if (!row) continue;
    for (let c = 0; c < mapColumns; c++) {
      const cell = row[c];
      if (cell?.cityId && String(cell.cityId) === target) {
        return buildFootprint(r, c, false);
      }
    }
  }
  return new Set();
}

/** 两格是否为 4-邻接 */
function isNeighbor4(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return (dx + dy) === 1;
}

module.exports = {
  loadRoadGrid,
  loadRoadGridSan1YuVerticalStack,
  isSan1YuStackRoadJunId,
  findMainCityFootprint,
  cellKey,
  isNeighbor4,
  neighborOffsets4,
  mergedJsonFilename,
};
