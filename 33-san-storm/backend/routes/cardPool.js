/**
 * 卡池抽取API路由
 * 
 * @description 临时模拟卡池，模拟满发展度3000
 * @module backend/routes/cardPool
 */

const express = require('express');
const router = express.Router();
const cardPoolService = require('../services/cardPoolService');
const { requireAuth, requireSelf } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');
const { validateBody, v } = require('../middleware/validation');

/** 鉴权（必改 #1）：本路由全部要求合法 JWT；URL/Body 中的 playerId 须 token.sub 与之匹配。 */
router.use(requireAuth);
router.param('playerId', requireSelf());

/**
 * 获取卡池状态
 * GET /api/card-pool/status/:playerId
 */
router.get('/status/:playerId', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const status = await cardPoolService.getPoolStatus(playerId);
    res.json({ success: true, ...status });
  } catch (error) {
    return next(wrap500(error, '获取卡池状态失败'));
  }
});

/**
 * 抽取卡牌
 * POST /api/card-pool/draw
 * Body: { playerId, poolType: 'troop' | 'character' | 'item', poolSeason?: 'san_1' | 'san_0' }
 */
router.post(
  '/draw',
  validateBody({
    playerId: v.required(v.nonEmptyString({ max: 64 })),
    poolType: v.required(v.enum(['troop', 'character', 'item'])),
    poolSeason: v.optional(v.enum(['san_0', 'san_1'])),
    drawMode: v.optional(v.enum(['batch', 'badge_batch'])),
  }),
  async (req, res, next) => {
  try {
    const { playerId, poolType, poolSeason, drawMode } = req.body;
    const devBypass = req.player._devBypass && req.player.sub == null;
    if (!devBypass && req.player.role !== 'admin' && String(playerId) !== String(req.player.sub)) {
      return res.status(403).json({ success: false, error: '无权代他人抽卡', code: 'FORBIDDEN' });
    }

    const result = await cardPoolService.drawFromPool(playerId, poolType, { poolSeason, drawMode });
    res.json(result);
  } catch (error) {
    const isBusiness =
      typeof error?.message === 'string' &&
      (error.message.includes('不足') ||
        error.message.includes('已用完') ||
        error.message.includes('无效') ||
        error.message.includes('未开启') ||
        error.message.includes('十连') ||
        error.message.includes('单抽') ||
        error.message.includes('徽章') ||
        error.message.includes('仅支持') ||
        error.message.includes('无可用'));
    if (!isBusiness) {
      return next(wrap500(error, '抽卡失败'));
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * 卡池重复残影三选一
 * POST /api/card-pool/draw/echo-choice
 * Body: { playerId, pendingEchoDrawId, choice: 'attack'|'defense'|'convert' }
 */
router.post(
  '/draw/echo-choice',
  validateBody({
    playerId: v.required(v.nonEmptyString({ max: 64 })),
    pendingEchoDrawId: v.required(v.integer({ min: 1 })),
    choice: v.required(v.enum(['attack', 'defense', 'convert'])),
  }),
  async (req, res, next) => {
    try {
      const { playerId, pendingEchoDrawId, choice } = req.body;
      const devBypass = req.player._devBypass && req.player.sub == null;
      if (!devBypass && req.player.role !== 'admin' && String(playerId) !== String(req.player.sub)) {
        return res.status(403).json({ success: false, error: '无权代他人处理重复选择', code: 'FORBIDDEN' });
      }

      const result = await cardPoolService.resolveEchoChoice(
        playerId,
        pendingEchoDrawId,
        choice,
      );
      res.json(result);
    } catch (error) {
      if (error.statusCode === 403) {
        return res.status(403).json({ success: false, error: error.message });
      }
      if (error.statusCode === 422) {
        return res.status(422).json({ success: false, error: error.message, code: 'POOL_ECHO_FULL' });
      }
      const isBusiness =
        typeof error?.message === 'string' &&
        (error.message.includes('不存在') ||
          error.message.includes('无效') ||
          error.message.includes('已处理') ||
          error.message.includes('无权') ||
          error.message.includes('仅将领'));
      if (!isBusiness) {
        return next(wrap500(error, '重复选择处理失败'));
      }
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

module.exports = router;
