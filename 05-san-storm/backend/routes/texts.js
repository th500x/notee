/**
 * 玩家传书 API
 * GET  .../players/:playerId/texts/summary
 * GET  .../players/:playerId/texts
 * POST .../players/:playerId/texts/:textId/read
 * POST .../players/:playerId/texts/:textId/claim
 */

const express = require('express');
const textsService = require('../services/textsService');
const { wrap500 } = require('../utils/httpError');
const { validateParams, validateQuery } = require('../middleware/validation');
const textSchemas = require('../middleware/validationSchemas/texts');

const router = express.Router({ mergeParams: true });

router.get('/summary', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const unreadCount = await textsService.countUnread(playerId);
    res.json({ success: true, unreadCount });
  } catch (err) {
    return next(wrap500(err, '查询失败'));
  }
});

router.get('/', validateQuery(textSchemas.inboxQuery), async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const { limit } = req.query;
    const texts = await textsService.listInbox(playerId, { limit });
    res.json({ success: true, texts });
  } catch (err) {
    return next(wrap500(err, '查询失败'));
  }
});

router.post(
  '/:textId/read',
  validateParams(textSchemas.textIdParam),
  async (req, res, next) => {
    try {
      const { playerId, textId } = req.params;
      const ok = await textsService.markRead(playerId, textId);
      if (!ok) {
        return res.status(404).json({ success: false, error: '传书不存在' });
      }
      res.json({ success: true });
    } catch (err) {
      return next(wrap500(err, '更新失败'));
    }
  },
);

router.post(
  '/:textId/claim',
  validateParams(textSchemas.textIdParam),
  async (req, res, next) => {
    try {
      const { playerId, textId } = req.params;
      const result = await textsService.claimReward(playerId, textId);
      if (!result.ok) {
        return res.status(400).json({ success: false, error: result.error });
      }
      const details = Array.isArray(result.details) ? result.details : [];
      let safeDetails = details;
      try {
        safeDetails = JSON.parse(JSON.stringify(details));
      } catch {
        safeDetails = [];
      }
      res.json({ success: true, data: { details: safeDetails }, details: safeDetails });
    } catch (err) {
      return next(wrap500(err, '领取失败'));
    }
  },
);

module.exports = router;
