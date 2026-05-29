/**
 * 玩家路由 · 势力 Tab（O3-B1）
 */
const express = require('express');
const factionOverviewService = require('../../services/factionOverviewService');
const factionBulletinService = require('../../services/factionBulletinService');
const { withRoute } = require('../../utils/routeAdapter');

const router = express.Router();

router.get('/:playerId/faction/overview', withRoute('获取势力信息失败', async (req, res) => {
  const result = await factionOverviewService.getFactionOverviewForPlayer(req.params.playerId);
  if (result.notFound) return res.status(404).json({ success: false, error: '玩家不存在' });
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: result.data });
}));

router.get('/:playerId/faction/bulletin', withRoute('获取势力公告失败', async (req, res) => {
  const lim = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const category = req.query.category != null ? String(req.query.category).trim() : null;
  const out = await factionBulletinService.getBulletinForPlayer(req.params.playerId, {
    limit: lim,
    category,
  });
  if (out.notFound) return res.status(404).json({ success: false, error: out.error });
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: out.data });
}));

module.exports = router;
