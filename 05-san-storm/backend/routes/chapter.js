/**
 * 章节战棋 API
 * @module backend/routes/chapter
 */

const express = require('express');
const router = express.Router();
const chapterService = require('../services/chapterService');
const { requireAuth } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');
const { validateBody, validateQuery } = require('../middleware/validation');
const schemas = require('../middleware/validationSchemas/chapter');

router.use(requireAuth);

/** GET /api/chapter/center?playerId=&season= */
router.get('/center', validateQuery(schemas.centerQuery), async (req, res, next) => {
  try {
    const season = req.query.season || 'san_1';
    const data = await chapterService.getChapterCenterPayload(req.query.playerId, season);
    res.json(data);
  } catch (error) {
    return next(wrap500(error, '获取章节中心失败'));
  }
});

/** POST /api/chapter/start-node */
router.post('/start-node', validateBody(schemas.startNodeBody), async (req, res, next) => {
  try {
    const { playerId, chapterId, nodeId } = req.body;
    if (req.playerId && String(req.playerId) !== String(playerId)) {
      return res.status(403).json({ success: false, error: '无权操作该档案' });
    }
    const result = await chapterService.startNode(playerId, chapterId, nodeId);
    if (!result.ok) {
      const status = result.code === 'NO_TACTIC_TOKEN' ? 400 : 400;
      return res.status(status).json({ success: false, error: result.error, code: result.code });
    }
    res.json({ success: true, ...result });
  } catch (error) {
    return next(wrap500(error, '开启章节节点失败'));
  }
});

/** POST /api/chapter/complete-node */
router.post('/complete-node', validateBody(schemas.completeNodeBody), async (req, res, next) => {
  try {
    const { playerId, chapterId, nodeId } = req.body;
    if (req.playerId && String(req.playerId) !== String(playerId)) {
      return res.status(403).json({ success: false, error: '无权操作该档案' });
    }
    const result = await chapterService.completeNode(playerId, chapterId, nodeId);
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true, ...result });
  } catch (error) {
    return next(wrap500(error, '完成章节节点失败'));
  }
});

/** POST /api/chapter/claim-reward */
router.post('/claim-reward', validateBody(schemas.claimRewardBody), async (req, res, next) => {
  try {
    const { playerId, chapterId } = req.body;
    if (req.playerId && String(req.playerId) !== String(playerId)) {
      return res.status(403).json({ success: false, error: '无权操作该档案' });
    }
    const result = await chapterService.claimChapterReward(playerId, chapterId);
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true, ...result });
  } catch (error) {
    return next(wrap500(error, '领取章节奖励失败'));
  }
});

module.exports = router;
