/**
 * 匪寨世界实例 `bandits` 行：与合并图 `cells` 上 **`banditPoiId`**（`san_*_bandit_*`）对齐。
 * 占位由 `strategicBanditPlaceholderPhase1` 写入 JSON；本服务负责 **幂等补库**（INSERT IGNORE），不手改主数据。
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../database/connection');
const { readStrategicCellAnchorId } = require('../../shared/utils/strategicCellAnchorId.js');
const {
  getPhase1BanditPoiIdsForJun,
} = require('../../shared/utils/strategicBanditPlaceholderPhase1.js');

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
  let repaired = 0;
  for (let i = 0; i < ids.length; i++) {
    const banditId = ids[i];
    const slot = Math.min(255, i);
    const [r] = await pool.query(
      `INSERT INTO bandits (bandit_id, jun_id, slot_index, tile_key, max_layers, cleared_layers, status)
       VALUES (?, ?, ?, NULL, 200, 0, 'active')
       ON DUPLICATE KEY UPDATE
         jun_id = VALUES(jun_id),
         slot_index = VALUES(slot_index),
         max_layers = IF(COALESCE(max_layers, 0) <= 0, 200, max_layers),
         cleared_layers = IF(cleared_layers IS NULL, 0, cleared_layers)`,
      [banditId, jun, slot]
    );
    if (r.affectedRows === 1) ensured += 1;
    else if (r.affectedRows === 2) repaired += 1;
  }
  return { ensured, repaired, banditIds: ids };
}

/**
 * 无合并图时也可调用：按郡阶段一约定补 **`bandits`** 两行（颍川 / 汝南）。
 * @param {string} junId
 * @returns {Promise<{ ensured: number, repaired: number, banditIds: string[] }>}
 */
async function ensurePhase1BanditsForJunDb(junId) {
  const ids = getPhase1BanditPoiIdsForJun(junId);
  if (!ids.length) return { ensured: 0, repaired: 0, banditIds: [] };
  return ensureBanditRowsForPoiIds([...ids], junId);
}

/**
 * 读取单郡 `*_merged.json`，按格上网匪寨锚点补全 `bandits`（`jun_id` 取 JSON `junId`）。
 * @param {{ mergedAbsPath?: string }|null} [options] - `mergedAbsPath`：缺省为颍川默认路径（兼容旧调用）
 * @returns {Promise<{ ok: boolean, reason?: string, junId?: string, ensured?: number, banditIds?: string[], source?: string }>}
 */
async function syncBanditsFromMergedDisk(options = null) {
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
  /** 格网未带锚点字段的旧快照：仍按阶段一约定补两行（颍川 / 汝南各一组 id） */
  if (banditIds.length === 0 && Array.isArray(cells) && cells.length > 0) {
    const fallback = getPhase1BanditPoiIdsForJun(junId);
    if (fallback.length) {
      banditIds = [...fallback];
      source = 'phase1_fallback';
    }
  }
  if (banditIds.length === 0) {
    return { ok: true, junId, ensured: 0, banditIds: [], reason: 'NO_BANDIT_CELLS' };
  }
  const phase1Extra = getPhase1BanditPoiIdsForJun(junId);
  const mergedIds = [...new Set([...banditIds, ...phase1Extra])].sort();
  const { ensured, repaired, banditIds: ensuredIds } = await ensureBanditRowsForPoiIds(mergedIds, junId);
  return { ok: true, junId, ensured, repaired, banditIds: ensuredIds, source };
}

/** @deprecated 请使用 {@link syncBanditsFromMergedDisk} */
async function syncBanditsFromYingchuanMergedDisk(options = null) {
  return syncBanditsFromMergedDisk(options);
}

module.exports = {
  BANDIT_MAP_OBJECT_ID_RE,
  collectBanditPoiIdsFromCells,
  ensureBanditRowsForPoiIds,
  ensurePhase1BanditsForJunDb,
  syncBanditsFromMergedDisk,
  syncBanditsFromYingchuanMergedDisk,
  publicMergedAbsPath,
};
