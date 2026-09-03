/**
 * 章节战棋 API
 * @module backend/routes/chapter
 */

const express = require('express');
const router = express.Router();
const chapterService = require('../services/chapterService');
const { requireAuth, requireSelf } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');
const { validateBody, validateQuery } = require('../middleware/validation');
const schemas = require('../middleware/validationSchemas/chapter');

router.use(requireAuth);

/** 本组接口的 playerId 在 body / query 里，统一交给 requireSelf 判定（勿在处理函数内另写 403 分支） */
const requireSelfBody = requireSelf('playerId', { from: 'body' });
const requireSelfQuery = requireSelf('playerId', { from: 'query' });

/** GET /api/chapter/center?playerId=&season= */
router.get('/center', validateQuery(schemas.centerQuery), requireSelfQuery, async (req, res, next) => {
  try {
    const season = req.query.season || 'san_1';
    const data = await chapterService.getChapterCenterPayload(req.query.playerId, season);
    res.json(data);
  } catch (error) {
    return next(wrap500(error, '获取章节中心失败'));
  }
});

/** POST /api/chapter/start-node */
router.post('/start-node', validateBody(schemas.startNodeBody), requireSelfBody, async (req, res, next) => {
  try {
    const { playerId, chapterId, nodeId } = req.body;
    const result = await chapterService.startNode(playerId, chapterId, nodeId);
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error, code: result.code });
    }
    res.json({ success: true, ...result });
  } catch (error) {
    return next(wrap500(error, '开启章节节点失败'));
  }
});

/** POST /api/chapter/complete-node */
router.post('/complete-node', validateBody(schemas.completeNodeBody), requireSelfBody, async (req, res, next) => {
  try {
    const { playerId, chapterId, nodeId } = req.body;
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
router.post('/claim-reward', validateBody(schemas.claimRewardBody), requireSelfBody, async (req, res, next) => {
  try {
    const { playerId, chapterId } = req.body;
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
