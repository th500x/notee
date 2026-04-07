/**
 * 排行榜路由
 * HTTP 映射层：参数解析 + 调用 rankingService，无直接 SQL。
 *
 * @see docs/20-data-layer/27-1-STATISTICS_RANKING_SYSTEM.md（活动榜）
 * @see docs/20-data-layer/27-2-RANKING_PANEL.md（常驻榜 overall / campaign）
 * @see docs/00-base/01-DATABASE_DESIGN.md §4.3 temp_ranking_snapshots
 */

const express = require('express');
const router = express.Router();
const rankingService = require('../services/rankingService');

/**
 * GET /api/rankings/overall
 * 常驻 · 总体排名（场均战后分，同服）
 *
 * Query: serverId（可选，缺省且带 playerId 时由 accounts 反查）, limit, playerId,
 *   sort（可选：avg | wins | reputation | events，默认 avg=场均战后分）
 */
router.get('/overall', async (req, res) => {
  try {
    const limit = req.query.limit;
    const playerId = req.query.playerId || null;
    const serverId = req.query.serverId || null;
    const sort = req.query.sort || null;
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

/**
 * GET /api/rankings/campaign
 * 常驻 · 单场战役最高分榜（同服）
 *
 * Query: campaignId（必填）, serverId（可选）, limit, playerId
 */
router.get('/campaign', async (req, res) => {
  try {
    const campaignId = req.query.campaignId || '';
    const limit = req.query.limit;
    const playerId = req.query.playerId || null;
    const serverId = req.query.serverId || null;
    const data = await rankingService.getCampaignRankings({
      campaignId,
      limit,
      playerId,
      serverId,
    });
    res.json({ success: true, data });
  } catch (error) {
    const code = error.statusCode || 500;
    if (code >= 500) console.error('[rankings] campaign:', error);
    const msg =
      code === 400 ? error.message
        : code === 404 ? error.message
          : '获取战役排行失败';
    res.status(code).json({ success: false, error: msg });
  }
});

/**
 * GET /api/rankings/:eventId
 * 活动排行榜（须注册在 overall / campaign 之后）
 *
 * Query: ?limit=10&playerId=p001
 */
router.get('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const limit = req.query.limit;
    const playerId = req.query.playerId || null;

    const data = await rankingService.getRankings(eventId, { limit, playerId });

    res.json({ success: true, data });
  } catch (error) {
    console.error('[rankings] 获取排行榜失败:', error);
    res.status(500).json({ success: false, error: '获取排行榜失败' });
  }
});

module.exports = router;
