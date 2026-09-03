/**
 * 排行榜路由
 * HTTP 映射层：参数解析 + 调用 rankingService，无直接 SQL。
 */

const express = require('express');
const router = express.Router();
const rankingService = require('../services/rankingService');
const { wrap500 } = require('../utils/httpError');
const { validateParams, validateQuery } = require('../middleware/validation');
const rankingSchemas = require('../middleware/validationSchemas/rankings');

router.get('/overall', validateQuery(rankingSchemas.overallQuery), async (req, res, next) => {
  try {
    const { limit, playerId, serverId, sort } = req.query;
    const data = await rankingService.getOverallRankings({ limit, playerId, serverId, sort });
    res.json({ success: true, data });
  } catch (error) {
    const code = error.statusCode || 500;
    if (code >= 500) console.error('[rankings] overall:', error);
    res.status(code).json({
      success: false,
      error: code === 400 ? error.message : '获取总体排行失败',
    });
  }
});

router.get(
  '/:eventId',
  validateParams(rankingSchemas.eventIdParam),
  validateQuery(rankingSchemas.eventRankingsQuery),
  async (req, res, next) => {
    try {
      const { eventId } = req.params;
      const { limit, playerId } = req.query;
      const data = await rankingService.getRankings(eventId, { limit, playerId });
      res.json({ success: true, data });
    } catch (error) {
      return next(wrap500(error, '获取排行榜失败'));
    }
  },
);

module.exports = router;
