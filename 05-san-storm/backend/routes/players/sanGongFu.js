/**
 * 玩家路由 · 三公府 / 口谕（O3-B1）
 */
const express = require('express');
const positionPromotionService = require('../../services/positionPromotionService');
const kingEdictFeedbackService = require('../../services/kingEdictFeedbackService');
const sanGongTributeService = require('../../services/sanGongTributeService');
const sanGongStipendService = require('../../services/sanGongStipendService');
const sanGongDocumentService = require('../../services/sanGongDocumentService');
const factionBulletinService = require('../../services/factionBulletinService');
const pvpWarService = require('../../services/pvpWarService');
const cityService = require('../../services/cityService');
const { replyServiceOut, withRoute } = require('../../utils/routeAdapter');

const router = express.Router();

router.get('/:playerId/san-gong-fu/promotions', withRoute('获取晋升列表失败', async (req, res) => {
  return replyServiceOut(res, await positionPromotionService.getPromotionsForPlayer(req.params.playerId));
}));

router.post('/:playerId/san-gong-fu/promote', withRoute('晋升失败', async (req, res) => {
  return replyServiceOut(res, await positionPromotionService.promotePlayer(req.params.playerId, req.body?.positionId));
}));

router.post('/:playerId/king-edict-feedback', withRoute('口谕嘉奖失败', async (req, res) => {
  const scope = req.body?.scope === 'active_war' ? 'active_war' : 'casual';
  return replyServiceOut(res, await kingEdictFeedbackService.submitKingEdictFeedback(
    req.params.playerId,
    req.body?.reaction,
    { scope },
  ));
}));

router.get('/:playerId/san-gong-fu/tribute-status', withRoute('朝贡额度查询失败', async (req, res) => {
  const data = await sanGongTributeService.getTributeDailyStatus(req.params.playerId);
  res.json({ success: true, data });
}));

router.post('/:playerId/san-gong-fu/tribute', withRoute('朝贡失败', async (req, res) => {
  const out = await sanGongTributeService.submitTroopTribute(req.params.playerId, req.body?.instanceIds);
  if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
  res.json({ success: true, data: out });
}));

router.get('/:playerId/san-gong-fu/stipend-status', withRoute('俸禄状态查询失败', async (req, res) => {
  const data = await sanGongStipendService.getStipendStatus(req.params.playerId);
  res.json({ success: true, data });
}));

router.post('/:playerId/san-gong-fu/stipend-claim', withRoute('领取俸禄失败', async (req, res) => {
  const out = await sanGongStipendService.claimStipend(req.params.playerId);
  if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
  res.json({ success: true, data: out });
}));

router.get('/:playerId/san-gong-fu/pvp-attacking-wars', withRoute('查询势力战事失败', async (req, res) => {
  const data = await pvpWarService.listSanGongAttackingSiegeWarsForPlayer(req.params.playerId);
  res.json({ success: true, data });
}));

router.post('/:playerId/san-gong-fu/pvp-attacking-wars/:pvpWarId/cancel', withRoute('结束势力战事失败', async (req, res) => {
  const data = await pvpWarService.cancelAttackingSiegeWarViaSanGongChaoZheng(
    req.params.playerId,
    req.params.pvpWarId,
    req.body || {},
  );
  res.json({ success: true, data });
}));

router.post('/:playerId/san-gong-fu/pve-attacking-wars/:warId/cancel', withRoute('结束中立城攻城战事失败', async (req, res) => {
  const data = await cityService.cancelActivePveSiegeWarViaSanGongChaoZheng(
    req.params.playerId,
    req.params.warId,
    req.body || {},
  );
  res.json({ success: true, data });
}));

router.get('/:playerId/san-gong-fu/bulletin', withRoute('获取三公府公告失败', async (req, res) => {
  const limitPerCategory = Math.min(50, Math.max(1, Number(req.query.limitPerCategory) || 30));
  const out = await factionBulletinService.getSanGongGroupedBulletinForPlayer(req.params.playerId, {
    limitPerCategory,
  });
  if (out.notFound) return res.status(404).json({ success: false, error: out.error });
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: out.data });
}));

router.get('/:playerId/san-gong-fu/document-status', withRoute('获取文书发布状态失败', async (req, res) => {
  const status = await sanGongDocumentService.getDocumentDailyStatus(req.params.playerId);
  res.json({ success: true, data: status });
}));

router.post('/:playerId/san-gong-fu/document', withRoute('发布文书失败', async (req, res) => {
  return replyServiceOut(res, await sanGongDocumentService.postDocument(req.params.playerId, req.body?.body));
}));

module.exports = router;
