/**
 * 郡内道路栅格权威源（02 §2.1.2（5）、01 §3.2.24）。
 *
 * 优先级：
 *   1. MySQL 中已为该 season+junId 入库的道路数据（若迁移 / 管理端已写入专用表，
 *      以实装表名为准；目前仓内尚未建立独立表，本函数在无数据时回退 merged.json）。
 *   2. public/data/worldmap/{jun}_merged.json（与 worldMapAdminService、31-5 一致）。
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
const OBJECT_2X2 = new Set(['city_small', 'city_medium', 'city_major', 'gate', 'fort']);

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
  findMainCityFootprint,
  cellKey,
  isNeighbor4,
  neighborOffsets4,
  mergedJsonFilename,
};
