/**
 * 管理员：大地图 — 州郡列表、preset 完整性、坐标入库、邻接入库、生成合并 JSON
 */
const express = require('express');
const router = express.Router();
const worldMapAdminService = require('../services/worldMapAdminService');

/** 把 mysql2 常见错误转成管理页可读中文（避免仅显示 connect ECONNREFUSED） */
function clientErrorMessage(err, fallback) {
  if (!err) return fallback;
  if (err.code === 'ECONNREFUSED') {
    return '数据库拒绝连接：请启动 MySQL（如 XAMPP），并核对 05-san-storm/backend/.env 中 DB_HOST、DB_PORT、DB_NAME。';
  }
  if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.errno === 1045) {
    return '数据库账号或密码错误：请核对 .env 中 DB_USER、DB_PASSWORD。';
  }
  return err.message || fallback;
}

router.get('/geo-options', async (req, res) => {
  try {
    const data = await worldMapAdminService.listZhouJun();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[admin/world-map] geo-options:', err);
    res.status(500).json({ success: false, error: clientErrorMessage(err, '查询失败') });
  }
});

router.get('/jun/:junId/preset-status', async (req, res) => {
  try {
    const { junId } = req.params;
    const st = worldMapAdminService.checkJunPresetsComplete(junId);
    res.json({ success: true, data: st });
  } catch (err) {
    console.error('[admin/world-map] preset-status:', err);
    res.status(500).json({ success: false, error: err.message || '查询失败' });
  }
});

router.post('/coordinates-to-db', async (req, res) => {
  try {
    const { junId } = req.body || {};
    if (!junId || typeof junId !== 'string') {
      return res.status(400).json({ success: false, error: '需要 junId' });
    }
    const result = await worldMapAdminService.importCoordinatesFromPresets(junId.trim());
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[admin/world-map] coordinates-to-db:', err);
    const code = err.code === 'PRESET_INCOMPLETE' ? 400 : 500;
    res.status(code).json({ success: false, error: clientErrorMessage(err, '入库失败') });
  }
});

router.post('/boundaries-to-db', async (req, res) => {
  try {
    const { season, edges } = req.body || {};
    const result = await worldMapAdminService.importBoundaries({ season, edges });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[admin/world-map] boundaries-to-db:', err);
    const code = err.code === 'VALIDATION' ? 400 : 500;
    res.status(code).json({ success: false, error: clientErrorMessage(err, '入库失败') });
  }
});

/**
 * 生成合并大地图 JSON（当前仅 san_1_jun_yingchuan）→ public/data/worldmap/san_1_jun_yingchuan_merged.json
 */
router.post('/generate-merged-map', async (req, res) => {
  try {
    const { junId, seed } = req.body || {};
    const jid = (junId || '').trim();
    if (jid !== 'san_1_jun_yingchuan') {
      return res.status(400).json({
        success: false,
        error: '当前仅支持颍川郡 san_1_jun_yingchuan 生成合并图；其它郡后续迭代',
      });
    }
    const result = worldMapAdminService.generateYingchuanMergedMap({ seed });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[admin/world-map] generate-merged-map:', err);
    res.status(500).json({ success: false, error: err.message || '生成失败' });
  }
});

/**
 * 写入 merged.json 的 `roadCells` / `roadConnectivity`（与 §11 道路栅格一致），并刷新 `version`。
 */
router.post('/save-merged-road-cells', async (req, res) => {
  try {
    const { junId, roadCells, roadConnectivity } = req.body || {};
    const result = worldMapAdminService.saveRoadCellsToMergedMap({
      junId,
      roadCells,
      roadConnectivity,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[admin/world-map] save-merged-road-cells:', err);
    const code = err.code;
    const status =
      code === 'JUN_UNSUPPORTED' || code === 'NO_MERGED_FILE' || code === 'INVALID_MERGED'
        ? 400
        : code === 'OUT_OF_BOUNDS' || code === 'BLOCKED_CELL'
          ? 400
          : 500;
    res.status(status).json({ success: false, error: err.message || '保存失败' });
  }
});

/**
 * 按郡批量生成 NPC 守军（管理页）；与 seed-xinye-npc-garrison-400 同属 troopCountOverride 路径。
 * body: { junId, ownershipMode: 'player_owned' | 'npc_side', counts: { city_small?, city_medium?, ... }, season? }
 */
router.post('/batch-npc-garrison', async (req, res) => {
  try {
    const { junId, ownershipMode, counts, season } = req.body || {};
    const result = await worldMapAdminService.batchNpcGarrisonByJun({
      junId,
      ownershipMode,
      counts,
      season,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[admin/world-map] batch-npc-garrison:', err);
    const code = err.code;
    const status = code === 'VALIDATION' ? 400 : 500;
    res.status(status).json({ success: false, error: clientErrorMessage(err, '批量生成失败') });
  }
});

module.exports = router;
