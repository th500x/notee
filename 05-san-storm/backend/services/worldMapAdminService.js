/**
 * 管理员：大地图坐标入库、郡邻接入库、合并 JSON 写入 public/data/worldmap/
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pool } = require('../database/connection');
const cityService = require('./cityService');
const {
  normalizeRoadCellList,
  buildStrategicObjectFootprintBlockedSet,
  ROAD_CONNECTIVITY_4,
} = require('../../shared/utils/strategicRoadOverlay.js');

const SHARED_WORLDMAP_DIR = path.join(__dirname, '../../shared/data/worldmap');
const MERGED_REL_PUBLIC = 'data/worldmap/san_1_jun_yingchuan_merged.json';

/** 与 shared/utils/junCountyMapGenerator SAN_1_JUN_YINGCHUAN_MAJOR_QUAD_ORIGIN 一致（32×40 郡画布） */
const MAJOR_QUAD_ORIGIN = {
  A: { originGx: 0, originGy: 0 },
  B: { originGx: 16, originGy: 0 },
  C: { originGx: 16, originGy: 20 },
  D: { originGx: 0, originGy: 20 },
};

function listPresetFilenamesForJun(junId) {
  return ['A', 'B', 'C', 'D'].map((q) => ({
    quad: q,
    filename: `${junId}_quad_${q}.preset.json`,
  }));
}

function checkJunPresetsComplete(junId) {
  const missing = [];
  for (const { filename } of listPresetFilenamesForJun(junId)) {
    const fp = path.join(SHARED_WORLDMAP_DIR, filename);
    if (!fs.existsSync(fp)) missing.push(filename);
  }
  return { complete: missing.length === 0, missing };
}

async function listZhouJun() {
  const [zhouRows] = await pool.query(
    `SELECT zhou_id AS zhouId, season, zhou_name AS zhouName, sort_order AS sortOrder, enabled, description
     FROM config_zhou ORDER BY sort_order ASC, zhou_id ASC`
  );
  const [junRows] = await pool.query(
    `SELECT jun_id AS junId, season, zhou_id AS zhouId, jun_name AS junName, sort_order AS sortOrder, enabled, description
     FROM config_jun ORDER BY sort_order ASC, jun_id ASC`
  );
  return { zhou: zhouRows, jun: junRows };
}

/**
 * 从四象限 preset 的 strategic_cities 写入 cities.position_x / position_y（郡内 global gx,gy）
 */
async function importCoordinatesFromPresets(junId) {
  const { complete, missing } = checkJunPresetsComplete(junId);
  if (!complete) {
    const err = new Error(`郡 ${junId} 缺少 preset 文件：${missing.join(', ')}`);
    err.code = 'PRESET_INCOMPLETE';
    throw err;
  }

  let updated = 0;
  const notFound = [];

  for (const q of ['A', 'B', 'C', 'D']) {
    const fp = path.join(SHARED_WORLDMAP_DIR, `${junId}_quad_${q}.preset.json`);
    const raw = fs.readFileSync(fp, 'utf8');
    const preset = JSON.parse(raw);
    const cities = preset.strategic_cities || [];
    const { originGx, originGy } = MAJOR_QUAD_ORIGIN[q];

    for (const c of cities) {
      const cid = (c.city_id || '').trim();
      if (!cid) continue;
      const lc = c.gx != null ? Number(c.gx) : c.col != null ? Number(c.col) : null;
      const lr = c.gy != null ? Number(c.gy) : c.row != null ? Number(c.row) : null;
      if (lc == null || lr == null || Number.isNaN(lc) || Number.isNaN(lr)) continue;
      const gx = originGx + lc;
      const gy = originGy + lr;

      const [r] = await pool.query(
        `UPDATE cities SET position_x = ?, position_y = ? WHERE city_id = ?`,
        [gx, gy, cid]
      );
      if (r.affectedRows > 0) updated += 1;
      else notFound.push(cid);
    }
  }

  return { junId, updated, skippedNotInDb: [...new Set(notFound)] };
}

/**
 * 写入 config_jun_node（无向边；jun_id_a 字典序须 < jun_id_b，与表 PK 一致）
 */
async function importBoundaries({ season, edges }) {
  if (!season || !Array.isArray(edges)) {
    const err = new Error('需要 season 与 edges 数组');
    err.code = 'VALIDATION';
    throw err;
  }
  let inserted = 0;
  for (const e of edges) {
    let a;
    let b;
    if (Array.isArray(e) && e.length >= 2) {
      [a, b] = e;
    } else if (e && e.jun_id_a && e.jun_id_b) {
      a = e.jun_id_a;
      b = e.jun_id_b;
    } else {
      continue;
    }
    if (!a || !b || a === b) continue;
    const junA = a < b ? a : b;
    const junB = a < b ? b : a;
    await pool.query(
      `INSERT INTO config_jun_node (season, jun_id_a, jun_id_b)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE season = VALUES(season)`,
      [season, junA, junB]
    );
    inserted += 1;
  }
  return { season, inserted };
}

function publicMergedAbsPath() {
  return path.join(__dirname, '../../public', MERGED_REL_PUBLIC);
}

function readMergedJsonIfExists() {
  const outAbs = publicMergedAbsPath();
  if (!fs.existsSync(outAbs)) return null;
  try {
    const raw = fs.readFileSync(outAbs, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * 重新生成底板后保留既有道路层（管理员在 merged.json 中维护的 `roadCells`）。
 * @param {object|null} prev
 */
function preservedRoadLayerFrom(prev) {
  if (!prev || !Array.isArray(prev.roadCells) || prev.roadCells.length === 0) return null;
  return {
    roadCells: normalizeRoadCellList(prev.roadCells),
    roadConnectivity: prev.roadConnectivity === '8' ? '8' : ROAD_CONNECTIVITY_4,
  };
}

/**
 * 仅颍川郡：调用 Node 脚本写入与游戏内同路径的合并 JSON。
 * 若磁盘上已有 `roadCells`，合并进新文件（避免「生成地图」冲掉道路编辑）。
 */
function generateYingchuanMergedMap({ seed } = {}) {
  const prev = readMergedJsonIfExists();
  const preserved = preservedRoadLayerFrom(prev);

  const script = path.join(__dirname, '../scripts/worldmap-merge-yingchuan.mjs');
  const outAbs = publicMergedAbsPath();
  const outRel = '../public/data/worldmap/san_1_jun_yingchuan_merged.json';
  const args = [script, '--out', outRel];
  if (seed != null && seed !== '') args.push('--seed', String(seed));
  execFileSync(process.execPath, args, {
    cwd: path.join(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  let raw = fs.readFileSync(outAbs, 'utf8');
  let data = JSON.parse(raw);
  if (preserved && preserved.roadCells.length > 0) {
    data.roadCells = preserved.roadCells;
    data.roadConnectivity = preserved.roadConnectivity;
    fs.writeFileSync(outAbs, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    raw = fs.readFileSync(outAbs, 'utf8');
    data = JSON.parse(raw);
  }
  return {
    path: MERGED_REL_PUBLIC,
    absolutePath: outAbs,
    version: data.version,
    junId: data.junId,
    seed: data.seed,
    mapColumns: data.mapColumns,
    mapRows: data.mapRows,
    generatedAt: data.generatedAt,
  };
}

/**
 * 写入 merged.json 中的道路栅格（玩法真相；矢量由前端按同数据绘制）。
 * @param {{ junId: string, roadCells: unknown, roadConnectivity?: string }} payload
 */
function saveRoadCellsToMergedMap(payload) {
  const junId = (payload?.junId || '').trim();
  if (junId !== 'san_1_jun_yingchuan') {
    const err = new Error('当前仅支持颍川郡 san_1_jun_yingchuan 道路保存');
    err.code = 'JUN_UNSUPPORTED';
    throw err;
  }
  const outAbs = publicMergedAbsPath();
  if (!fs.existsSync(outAbs)) {
    const err = new Error('合并地图文件不存在，请先执行「生成地图」');
    err.code = 'NO_MERGED_FILE';
    throw err;
  }
  const raw = fs.readFileSync(outAbs, 'utf8');
  const data = JSON.parse(raw);
  if (!data.cells || !Array.isArray(data.cells)) {
    const err = new Error('合并 JSON 无效（缺 cells）');
    err.code = 'INVALID_MERGED';
    throw err;
  }

  const mapColumns = Number(data.mapColumns);
  const mapRows = Number(data.mapRows);
  if (!Number.isFinite(mapColumns) || !Number.isFinite(mapRows)) {
    const err = new Error('合并 JSON 缺有效 mapColumns / mapRows');
    err.code = 'INVALID_MERGED';
    throw err;
  }

  const roadConnectivity = payload?.roadConnectivity === '8' ? '8' : ROAD_CONNECTIVITY_4;
  const roadCells = normalizeRoadCellList(payload?.roadCells);
  const blocked = buildStrategicObjectFootprintBlockedSet(data.cells, mapColumns, mapRows);

  for (const { gx, gy } of roadCells) {
    if (gx < 0 || gy < 0 || gx >= mapColumns || gy >= mapRows) {
      const err = new Error(`道路格越界：(${gx},${gy})，有效范围 0…${mapColumns - 1} / 0…${mapRows - 1}`);
      err.code = 'OUT_OF_BOUNDS';
      throw err;
    }
    if (blocked.has(`${gx},${gy}`)) {
      const err = new Error(
        `道路格与战略对象占位冲突（城/关/据点 2×2 禁区）：(${gx},${gy})`,
      );
      err.code = 'BLOCKED_CELL';
      throw err;
    }
  }

  data.roadCells = roadCells;
  data.roadConnectivity = roadConnectivity;
  data.version = Date.now();
  fs.writeFileSync(outAbs, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  return {
    path: MERGED_REL_PUBLIC,
    absolutePath: outAbs,
    version: data.version,
    roadCellCount: roadCells.length,
    roadConnectivity,
  };
}

/** 与 cityService NPC 默认表、匪寨 tier 解析用的 city_type 一致 */
const NPC_BATCH_CITY_TYPES = ['city_small', 'city_medium', 'city_major', 'gate', 'fort'];

function parseTroopCountForBatch(raw) {
  if (raw === '' || raw == null) return null;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(2000, Math.floor(n));
}

/**
 * 按郡 + 归属筛选批量写入 NPC 守军（每城调用 generateNpcGarrison + troopCountOverride）。
 * 归属与 cityService.isCityOccupiedForNpcGarrison 一致：faction_id 非空且 status = owned 为「势力占城」。
 *
 * @param {{ junId: string, ownershipMode: 'player_owned'|'npc_side', counts: Record<string, unknown>, season?: string }}
 * @returns {Promise<{ junId: string, ownershipMode: string, matchedTotal: number, updated: number, skipped: Array<{ cityId: string, cityType: string, reason: string }>, failures: Array<{ cityId: string, error: string }> }>}
 */
async function batchNpcGarrisonByJun({ junId, ownershipMode, counts, season }) {
  const jid = String(junId || '').trim();
  if (!jid) {
    const err = new Error('需要 junId');
    err.code = 'VALIDATION';
    throw err;
  }
  const mode = String(ownershipMode || '').trim();
  if (mode !== 'player_owned' && mode !== 'npc_side') {
    const err = new Error('ownershipMode 须为 player_owned（势力占城）或 npc_side（非占城 / 中立等）');
    err.code = 'VALIDATION';
    throw err;
  }

  const normalizedCounts = {};
  const src = counts && typeof counts === 'object' ? counts : {};
  for (const ct of NPC_BATCH_CITY_TYPES) {
    const parsed = parseTroopCountForBatch(src[ct]);
    if (parsed != null) normalizedCounts[ct] = parsed;
  }
  if (Object.keys(normalizedCounts).length === 0) {
    const err = new Error('请至少为一种 city_type 填写守军支数（正整数，最大 2000）');
    err.code = 'VALIDATION';
    throw err;
  }

  const ownedClause =
    "(c.faction_id IS NOT NULL AND c.faction_id <> '' AND c.status = 'owned')";
  const filterClause = mode === 'player_owned' ? ownedClause : `NOT (${ownedClause})`;

  const params = [jid];
  let seasonClause = '';
  if (season != null && String(season).trim() !== '') {
    seasonClause = ' AND c.season = ?';
    params.push(String(season).trim());
  }

  const countParams = [...params];
  const [[junStats]] = await pool.query(
    `SELECT COUNT(*) AS citiesInJun,
            COALESCE(SUM(
              c.faction_id IS NOT NULL AND c.faction_id <> '' AND c.status = 'owned'
            ), 0) AS ownedCountInJun
     FROM cities c
     WHERE c.jun_id = ? ${seasonClause}`,
    countParams
  );
  const citiesInJun = Number(junStats?.citiesInJun) || 0;
  const ownedCountInJun = Number(junStats?.ownedCountInJun) || 0;

  const [rows] = await pool.query(
    `SELECT c.city_id AS cityId, c.city_type AS cityType
     FROM cities c
     WHERE c.jun_id = ? ${seasonClause} AND ${filterClause}
     ORDER BY c.city_type, c.city_name`,
    params
  );

  const skipped = [];
  const failures = [];
  let updated = 0;

  for (const row of rows) {
    const cityId = row.cityId;
    const cityType = row.cityType || '';
    const troopCount = normalizedCounts[cityType];
    if (troopCount == null) {
      skipped.push({ cityId, cityType, reason: 'no_count_for_type' });
      continue;
    }
    try {
      await cityService.generateNpcGarrison(cityId, { troopCountOverride: troopCount });
      updated += 1;
    } catch (e) {
      failures.push({ cityId, error: e?.message || String(e) });
    }
  }

  let hint = null;
  if (rows.length === 0) {
    if (citiesInJun === 0) {
      hint =
        '该郡在当前 season 下 cities 表无行（或 jun_id 未对齐）。请先跑城市种子 / 坐标入库后再试。';
    } else if (mode === 'player_owned' && ownedCountInJun === 0) {
      hint =
        '郡内有城，但尚无「占城」数据：种子导入默认 status=neutral，仅攻城结算后才会出现 status=owned。若要配中立城守军，请改用「归属 NPC 方」。';
    } else if (mode === 'npc_side' && citiesInJun > 0 && ownedCountInJun === citiesInJun) {
      hint = '郡内城全部为占城态，本模式下无匹配；若需改守军请用「归属势力方」。';
    }
  }

  return {
    junId: jid,
    ownershipMode: mode,
    season: season != null && String(season).trim() !== '' ? String(season).trim() : null,
    citiesInJun,
    ownedCountInJun,
    matchedTotal: rows.length,
    updated,
    skipped,
    failures,
    hint,
  };
}

module.exports = {
  SHARED_WORLDMAP_DIR,
  MERGED_REL_PUBLIC,
  listZhouJun,
  checkJunPresetsComplete,
  importCoordinatesFromPresets,
  importBoundaries,
  generateYingchuanMergedMap,
  saveRoadCellsToMergedMap,
  batchNpcGarrisonByJun,
};
