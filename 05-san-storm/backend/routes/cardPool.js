/**
 * 卡池抽取API路由
 * 
 * @description 临时模拟卡池，模拟满发展度3000
 * @module backend/routes/cardPool
 */

const express = require('express');
const router = express.Router();
const cardPoolService = require('../services/cardPoolService');

/**
 * 获取卡池状态
 * GET /api/card-pool/status/:playerId
 */
router.get('/status/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const status = await cardPoolService.getPoolStatus(playerId);
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('[card-pool/status] 获取卡池状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 抽取卡牌
 * POST /api/card-pool/draw
 * Body: { playerId, poolType: 'troop' | 'character' }
 */
router.post('/draw', async (req, res) => {
  try {
    const { playerId, poolType } = req.body;

    if (!playerId || !poolType) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    if (poolType !== 'troop' && poolType !== 'character') {
      return res.status(400).json({ success: false, error: 'poolType 必须为 troop 或 character' });
    }

    const result = await cardPoolService.drawFromPool(playerId, poolType);
    res.json(result);
  } catch (error) {
    console.error('[card-pool/draw] 抽取失败:', error);
    const status = error.message.includes('不足') || error.message.includes('已用完') ? 400 : 500;
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;
