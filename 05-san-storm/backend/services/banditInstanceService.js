/**
 * 匪寨世界实例 `bandits` 行：与合并图 `cells` 上 **`banditPoiId`**（`san_*_bandit_*`）对齐。
 * 占位由 `strategicBanditPlaceholderPhase1` 写入 JSON；本服务负责 **幂等补库**（INSERT IGNORE），不手改主数据。
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../database/connection');
const { readStrategicCellAnchorId } = require('../../shared/utils/strategicCellAnchorId.js');
const { YINGCHUAN_PHASE1_BANDIT_POI_IDS } = require('../../shared/utils/strategicBanditPlaceholderPhase1.js');

const MERGED_REL_PUBLIC = 'data/worldmap/san_1_jun_yingchuan_merged.json';

/** 与 `playerBanditRaidQuotaService` 匪寨地图对象 ID 校验一致 */
const BANDIT_MAP_OBJECT_ID_RE = /^san_\d+_bandit_[1-9]_[a-z0-9_]+$/i;

function publicMergedAbsPath() {
  return path.join(__dirname, '../../public', MERGED_REL_PUBLIC);
}

/**
 * 从合并图二维格网收集出现的匪寨锚点 ID（去重）。
 * @param {unknown[][]|null|undefined} cells
 * @returns {string[]}
 */
function collectBanditPoiIdsFromCells(cells) {
  const out = new Set();
  if (!Array.isArray(cells) || !cells.length) return [];
  for (let gy = 0; gy < cells.length; gy++) {
    const row = cells[gy];
    if (!Array.isArray(row)) continue;
    for (let gx = 0; gx < row.length; gx++) {
      const id = String(readStrategicCellAnchorId(row[gx]) || '').trim();
      if (!id || !BANDIT_MAP_OBJECT_ID_RE.test(id)) continue;
      out.add(id);
    }
  }
  return [...out].sort();
}

/**
 * 为给定匪寨 POI 列表补 `bandits` 行（已存在则忽略）。
 * @param {string[]} banditIds
 * @param {string} junId
 * @returns {Promise<{ ensured: number, banditIds: string[] }>}
 */
async function ensureBanditRowsForPoiIds(banditIds, junId) {
  const jun = String(junId || '').trim() || 'san_1_jun_yingchuan';
  const ids = [...new Set((banditIds || []).map((s) => String(s || '').trim()).filter((id) => BANDIT_MAP_OBJECT_ID_RE.test(id)))].sort();
  let ensured = 0;
  for (let i = 0; i < ids.length; i++) {
    const banditId = ids[i];
    const [r] = await pool.query(
      `INSERT IGNORE INTO bandits (bandit_id, jun_id, slot_index, tile_key, max_layers, cleared_layers, status)
       VALUES (?, ?, ?, NULL, 200, 0, 'active')`,
      [banditId, jun, Math.min(255, i)]
    );
    if (r.affectedRows > 0) ensured += 1;
  }
  return { ensured, banditIds: ids };
}

/**
 * 读取颍川合并图 JSON，按格上网匪寨锚点补全 `bandits`。
 * @param {{ mergedAbsPath?: string }|null} [options] - `mergedAbsPath`：覆盖默认 `public/data/worldmap/san_1_jun_yingchuan_merged.json`（CLI `--out` 时用）
 * @returns {Promise<{ ok: boolean, reason?: string, junId?: string, ensured?: number, banditIds?: string[], source?: string }>}
 */
async function syncBanditsFromYingchuanMergedDisk(options = null) {
  const abs = (options && options.mergedAbsPath) || publicMergedAbsPath();
  if (!fs.existsSync(abs)) {
    return { ok: false, reason: 'NO_MERGED_FILE', banditIds: [] };
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    return { ok: false, reason: 'INVALID_JSON', banditIds: [] };
  }
  const cells = data.cells;
  const junId = String(data.junId || '').trim() || 'san_1_jun_yingchuan';
  let banditIds = collectBanditPoiIdsFromCells(cells);
  let source = 'cells';
  /** 格网未带锚点字段的旧快照：颍川阶段一仍按生成器约定补两行（与 `ensureYingchuanMergedMapCells` 一致） */
  if (banditIds.length === 0 && junId === 'san_1_jun_yingchuan' && Array.isArray(cells) && cells.length > 0) {
    banditIds = [...YINGCHUAN_PHASE1_BANDIT_POI_IDS];
    source = 'phase1_fallback';
  }
  if (banditIds.length === 0) {
    return { ok: true, junId, ensured: 0, banditIds: [], reason: 'NO_BANDIT_CELLS' };
  }
  const { ensured } = await ensureBanditRowsForPoiIds(banditIds, junId);
  return { ok: true, junId, ensured, banditIds, source };
}

module.exports = {
  BANDIT_MAP_OBJECT_ID_RE,
  collectBanditPoiIdsFromCells,
  ensureBanditRowsForPoiIds,
  syncBanditsFromYingchuanMergedDisk,
  publicMergedAbsPath,
};
