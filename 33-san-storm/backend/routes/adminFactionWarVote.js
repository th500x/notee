/**
 * 管理员：手动触发战事公议日切（结票 + 开票）
 */
const express = require('express');
const router = express.Router();
const factionWarVoteService = require('../services/factionWarVoteService');
const { wrap500 } = require('../utils/httpError');

router.post('/daily-tick', async (req, res, next) => {
  try {
    const factionId = req.body?.factionId != null ? String(req.body.factionId).trim() : '';
    const result = await factionWarVoteService.runDailyTick(factionId ? { factionId } : {});
    res.json({ success: true, data: result });
  } catch (err) {
    return next(wrap500(err, '战事公议 tick 失败'));
  }
});

module.exports = router;
