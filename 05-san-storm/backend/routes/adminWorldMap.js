/**
 * 管理员：大地图 — 州郡列表、preset 完整性、坐标入库、邻接入库、生成合并 JSON
 */
const express = require('express');
const router = express.Router();
const worldMapAdminService = require('../services/worldMapAdminService');
const { wrap500 } = require('../utils/httpError');
const { validateBody, validateParams } = require('../middleware/validation');
const adminWorldMapSchemas = require('../middleware/validationSchemas/adminWorldMap');

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

router.get('/geo-options', async (req, res, next) => {
  try {
    const data = await worldMapAdminService.listZhouJun();
    res.json({ success: true, data });
  } catch (err) {
    return next(wrap500(err, clientErrorMessage(err, '查询失败')));
  }
});

router.get(
  '/jun/:junId/preset-status',
  validateParams(adminWorldMapSchemas.junIdParam),
  async (req, res, next) => {
    try {
      const st = worldMapAdminService.checkJunPresetsComplete(req.params.junId);
      res.json({ success: true, data: st });
    } catch (err) {
      return next(wrap500(err, '查询失败'));
    }
  },
);

router.get(
  '/jun/:junId/quad-preset/:quad',
  validateParams(adminWorldMapSchemas.junQuadParams),
  async (req, res, next) => {
    try {
      const { junId, quad } = req.params;
      const data = worldMapAdminService.readQuadPresetJson(junId, quad);
      res.json({ success: true, data });
    } catch (err) {
      const code = err.code;
      const status =
        code === 'VALIDATION' ? 400 : code === 'NOT_FOUND' ? 404 : 500;
      if (status >= 500) {
        return next(wrap500(err, '读取失败'));
      }
      res.status(status).json({ success: false, error: err.message || '读取失败' });
    }
  },
);

router.post(
  '/coordinates-to-db',
  validateBody(adminWorldMapSchemas.junIdBody),
  async (req, res, next) => {
    try {
      const result = await worldMapAdminService.importCoordinatesFromPresets(String(req.body.junId).trim());
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('[admin/world-map] coordinates-to-db:', err);
      const code = err.code === 'PRESET_INCOMPLETE' ? 400 : 500;
      res.status(code).json({ success: false, error: clientErrorMessage(err, '入库失败') });
    }
  },
);

router.post(
  '/boundaries-to-db',
  validateBody(adminWorldMapSchemas.boundariesBody),
  async (req, res, next) => {
    try {
      const { season, edges } = req.body;
      const result = await worldMapAdminService.importBoundaries({ season, edges });
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('[admin/world-map] boundaries-to-db:', err);
      const code = err.code === 'VALIDATION' ? 400 : 500;
      res.status(code).json({ success: false, error: clientErrorMessage(err, '入库失败') });
    }
  },
);

router.post(
  '/generate-merged-map',
  validateBody(adminWorldMapSchemas.generateMergedMapBody),
  async (req, res, next) => {
    try {
      const { junId, seed } = req.body;
      const result = await worldMapAdminService.generateJunMergedMap({ junId: String(junId).trim(), seed });
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('[admin/world-map] generate-merged-map:', err);
      const code = err.code;
      const status = code === 'PRESET_INCOMPLETE' || code === 'VALIDATION' ? 400 : 500;
      res.status(status).json({ success: false, error: clientErrorMessage(err, '生成失败') });
    }
  },
);

router.post(
  '/save-merged-road-cells',
  validateBody(adminWorldMapSchemas.saveRoadCellsBody),
  async (req, res, next) => {
    try {
      const result = worldMapAdminService.saveRoadCellsToMergedMap(req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      const code = err.code;
      const status =
        code === 'JUN_UNSUPPORTED' || code === 'NO_MERGED_FILE' || code === 'INVALID_MERGED'
          ? 400
          : code === 'OUT_OF_BOUNDS' || code === 'BLOCKED_CELL'
            ? 400
            : 500;
      if (status >= 500) {
        return next(wrap500(err, '保存失败'));
      }
      res.status(status).json({ success: false, error: err.message || '保存失败' });
    }
  },
);

router.post(
  '/batch-npc-garrison',
  validateBody(adminWorldMapSchemas.batchNpcGarrisonBody),
  async (req, res, next) => {
    try {
      const { junId, ownershipMode, counts, season } = req.body;
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
  },
);

module.exports = router;
