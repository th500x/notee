/**
 * 玩家路由 · 真三日报（32-6）
 */
const express = require('express');
const dailyReportService = require('../../services/dailyReportService');
const { replyServiceOut, withRoute } = require('../../utils/routeAdapter');

const router = express.Router();

router.get('/:playerId/daily-report', withRoute('获取真三日报失败', async (req, res) => {
  return replyServiceOut(res, await dailyReportService.getDailyReport(req.params.playerId));
}));

router.post('/:playerId/daily-report/check-in', withRoute('真三日报签到失败', async (req, res) => {
  const out = await dailyReportService.claimDailyCheckIn(req.params.playerId);
  if (!out.ok) {
    return res.status(out.status || 400).json({ success: false, error: out.error });
  }
  return res.json({ success: true, data: out.data });
}));

router.get('/:playerId/daily-report/check-in-notify', withRoute('获取签到红点失败', async (req, res) => {
  const dot = await dailyReportService.hasCheckinNotifyDot(req.params.playerId);
  res.json({ success: true, data: { notifyDot: dot } });
}));

module.exports = router;
