/**
 * 管理员：手动触发 AI 君主 · 大司空日榜决选（调试）
 */

const express = require('express');
const router = express.Router();
const { requireAdminAccess } = require('../middleware/auth');
const aiKingDasikongDailyService = require('../services/aiKingDasikongDailyService');
const { wrap500 } = require('../utils/httpError');
const { validateBody } = require('../middleware/validation');
const adminKingSchemas = require('../middleware/validationSchemas/adminKingDasikong');

router.use(requireAdminAccess);

router.post('/daily-tick', validateBody(adminKingSchemas.dailyTickBody), async (req, res, next) => {
  try {
    const factionId = req.body?.factionId != null ? String(req.body.factionId).trim() : '';
    const result = await aiKingDasikongDailyService.runDailyTick(
      factionId ? { factionId } : {},
    );
    res.json({ success: true, data: result });
  } catch (err) {
    return next(wrap500(err, '大司空日榜 tick 失败'));
  }
});

module.exports = router;
