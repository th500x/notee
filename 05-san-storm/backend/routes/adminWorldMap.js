/**
 * 管理员：大地图 — 州郡列表、preset 完整性、坐标入库、邻接入库、生成合并 JSON
 */
const express = require('express');
const router = express.Router();
const worldMapAdminService = require('../services/worldMapAdminService');

router.get('/geo-options', async (req, res) => {
  try {
    const data = await worldMapAdminService.listZhouJun();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[admin/world-map] geo-options:', err);
    res.status(500).json({ success: false, error: err.message || '查询失败' });
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
    res.status(code).json({ success: false, error: err.message || '入库失败' });
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
    res.status(code).json({ success: false, error: err.message || '入库失败' });
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

module.exports = router;
