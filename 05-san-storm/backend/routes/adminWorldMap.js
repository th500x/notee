/**
 * 管理员：大地图 — 郡战略图工坊（Meowa / 槽位 / 道路）
 * 旧「三国地图」四象限合并 API 已归档至 `_archive/san-guo-di-tu/`。
 */
const express = require('express');
const router = express.Router();
const junStrategicWorkshopService = require('../services/junStrategicWorkshopService');
const { wrap500 } = require('../utils/httpError');
const { validateBody, validateParams } = require('../middleware/validation');
const adminWorldMapSchemas = require('../middleware/validationSchemas/adminWorldMap');
const fs = require('fs');

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

/** 31-1：郡战略图工坊 */
router.get('/jun-workshop/catalog', (req, res, next) => {
  try {
    const data = junStrategicWorkshopService.listWorkshopCatalog();
    res.json({ success: true, data });
  } catch (err) {
    return next(wrap500(err, '读取工坊目录失败'));
  }
});

router.get(
  '/jun-workshop/:junId',
  validateParams(adminWorldMapSchemas.junIdParam),
  (req, res, next) => {
    try {
      const data = junStrategicWorkshopService.getWorkshopBundle(req.params.junId);
      res.json({ success: true, data });
    } catch (err) {
      const code = err.code;
      const status =
        code === 'NOT_FOUND' || code === 'NO_MERGED_FILE'
          ? 404
          : code === 'VALIDATION'
            ? 400
            : 500;
      if (status >= 500) return next(wrap500(err, '读取工坊失败'));
      res.status(status).json({ success: false, error: err.message || '读取失败' });
    }
  },
);

router.get(
  '/jun-workshop/:junId/preview',
  validateParams(adminWorldMapSchemas.junIdParam),
  (req, res, next) => {
    try {
      const abs = junStrategicWorkshopService.resolvePreviewAbsPath(req.params.junId);
      res.setHeader('Cache-Control', 'no-store');
      res.type('png');
      fs.createReadStream(abs).pipe(res);
    } catch (err) {
      const status = err.code === 'NOT_FOUND' ? 404 : 500;
      if (status >= 500) return next(wrap500(err, '预览图读取失败'));
      res.status(status).json({ success: false, error: err.message || '预览图不存在' });
    }
  },
);

router.post(
  '/jun-workshop/save',
  validateBody(adminWorldMapSchemas.saveJunWorkshopBody),
  async (req, res, next) => {
    try {
      const result = await junStrategicWorkshopService.saveWorkshop(req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('[admin/world-map] jun-workshop/save:', err);
      const code = err.code;
      const status =
        code === 'NOT_FOUND' || code === 'NO_MERGED_FILE'
          ? 404
          : code === 'VALIDATION' ||
              code === 'OUT_OF_BOUNDS' ||
              code === 'BLOCKED_CELL'
            ? 400
            : 500;
      if (status >= 500) return next(wrap500(err, clientErrorMessage(err, '保存失败')));
      res.status(status).json({ success: false, error: err.message || '保存失败' });
    }
  },
);

module.exports = router;
