/**
 * 管理员：手动触发 AI 君主 · 每日传书（调试）
 */

const express = require('express');
const router = express.Router();
const aiKingDailyLetterService = require('../services/aiKingDailyLetterService');
const { wrap500 } = require('../utils/httpError');
const { validateBody } = require('../middleware/validation');
const adminKingSchemas = require('../middleware/validationSchemas/adminKingDasikong');

router.post('/daily-tick', validateBody(adminKingSchemas.dailyTickBody), async (req, res, next) => {
  try {
    const factionId = req.body?.factionId != null ? String(req.body.factionId).trim() : '';
    const result = await aiKingDailyLetterService.runDailyTick(factionId ? { factionId } : {});
    res.json({ success: true, data: result });
  } catch (err) {
    return next(wrap500(err, '君主每日传书 tick 失败'));
  }
});

module.exports = router;
