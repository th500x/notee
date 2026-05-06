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
 * Body: { playerId, poolType: 'troop' | 'character' }
 */
router.post(
  '/draw',
  validateBody({
    playerId: v.required(v.nonEmptyString({ max: 64 })),
    poolType: v.required(v.enum(['troop', 'character'])),
  }),
  async (req, res, next) => {
  try {
    const { playerId, poolType } = req.body;
    const devBypass = req.player._devBypass && req.player.sub == null;
    if (!devBypass && req.player.role !== 'admin' && String(playerId) !== String(req.player.sub)) {
      return res.status(403).json({ success: false, error: '无权代他人抽卡', code: 'FORBIDDEN' });
    }

    const result = await cardPoolService.drawFromPool(playerId, poolType);
    res.json(result);
  } catch (error) {
    // 业务级 4xx："X 不足 / X 已用完"等 service 抛出的中文文案 → 直接 status=400 + 透出文案；
    // 其余视作系统级 5xx，走 errorHandler 收口（不泄露 error.message 原文）。
    const isBusiness = typeof error?.message === 'string' && (error.message.includes('不足') || error.message.includes('已用完'));
    if (!isBusiness) {
      return next(wrap500(error, '抽卡失败'));
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
