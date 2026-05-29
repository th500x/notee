/**
 * 玩家路由 · 道路守门 / 移动 / 遭遇（O3-B1 · 02 §2.1.2）
 */
const express = require('express');
const { roadMoveLimiter } = require('../../middleware/rateLimit');
const roadEncounterService = require('../../services/roadEncounterService');
const { replyServiceOut, withRoute } = require('../../utils/routeAdapter');

const router = express.Router();

router.post('/:playerId/road/intercept', withRoute('切换道路开战模式失败', async (req, res) => {
  const { enable, clientRequestId } = req.body || {};
  if (typeof enable !== 'boolean') {
    return res.status(400).json({ success: false, error: 'enable 必须为 boolean' });
  }
  const out = await roadEncounterService.setIntercept(req.params.playerId, enable, clientRequestId);
  return replyServiceOut(res, out);
}));

router.get('/:playerId/road/self', withRoute('读取道路状态失败', async (req, res) => {
  const out = await roadEncounterService.getSelfRoadState(req.params.playerId);
  return replyServiceOut(res, out);
}));

router.post('/:playerId/road/move', roadMoveLimiter, withRoute('沿路移动失败', async (req, res) => {
  const out = await roadEncounterService.moveAlongRoad(req.params.playerId, req.body || {});
  return replyServiceOut(res, out);
}));

router.post('/:playerId/road/resolve-encounter', withRoute('解锁道路遭遇失败', async (req, res) => {
  const out = await roadEncounterService.resolveEncounter(req.params.playerId, req.body || {});
  return replyServiceOut(res, out);
}));

router.get('/:playerId/road/pending-encounter', withRoute('道路遇袭轮询失败', async (req, res) => {
  const out = await roadEncounterService.getPendingDefenderEncounter(req.params.playerId);
  return replyServiceOut(res, out);
}));

router.get('/:playerId/road/encounter-battle', withRoute('道路遭遇开战数据失败', async (req, res) => {
  const encounterId = req.query.encounterId != null ? String(req.query.encounterId).trim() : '';
  const spectator = String(req.query.spectator || '').trim() === '1';
  const out = await roadEncounterService.getEncounterBattlePayload(req.params.playerId, encounterId, { spectator });
  return replyServiceOut(res, out);
}));

router.post('/:playerId/road/encounter-authoritative-resolve', withRoute('道路权威结算失败', async (req, res) => {
  const encounterId = req.body?.encounterId != null ? String(req.body.encounterId).trim() : '';
  const out = await roadEncounterService.resolveAuthoritativeRoadEncounter(req.params.playerId, encounterId);
  return replyServiceOut(res, out);
}));

router.get('/:playerId/road/encounter-authoritative-outcome', withRoute('道路裁定查询失败', async (req, res) => {
  const encounterId = req.query.encounterId != null ? String(req.query.encounterId).trim() : '';
  const out = await roadEncounterService.getRoadEncounterAuthoritativeOutcome(req.params.playerId, encounterId);
  return replyServiceOut(res, out);
}));

router.post('/:playerId/road/encounter-battle-result', withRoute('道路遭遇结算失败', async (req, res) => {
  const out = await roadEncounterService.recordEncounterBattleSettlement(req.params.playerId, req.body || {});
  return replyServiceOut(res, out);
}));

module.exports = router;
