/**
 * 管理员：大地图坐标入库、郡邻接入库、合并 JSON 写入 public/data/worldmap/
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pool } = require('../database/connection');

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

/**
 * 仅颍川郡：调用 Node 脚本写入与游戏内同路径的合并 JSON。
 */
function generateYingchuanMergedMap({ seed } = {}) {
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
  const raw = fs.readFileSync(outAbs, 'utf8');
  const data = JSON.parse(raw);
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

module.exports = {
  SHARED_WORLDMAP_DIR,
  MERGED_REL_PUBLIC,
  listZhouJun,
  checkJunPresetsComplete,
  importCoordinatesFromPresets,
  importBoundaries,
  generateYingchuanMergedMap,
};
