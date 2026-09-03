/**
 * 玩家路由 · 赛季结算封档与发放（Phase 1/3 · 见 19-3 §7.1）
 *
 * GET  /:playerId/season-settlement/preview  预览自动继承 + 可选清单 + 上限
 * GET  /:playerId/season-settlement/status   封档/待发放/已发放状态
 * POST /:playerId/season-settlement/confirm  确认选择并封档
 * POST /:playerId/season-settlement/apply    新赛季创角后发放继承物品（幂等）
 */
const express = require('express');
const seasonSettlementService = require('../../services/seasonSettlementService');
const { replyServiceOut, withRoute } = require('../../utils/routeAdapter');

const router = express.Router();

router.get(
  '/:playerId/season-settlement/preview',
  withRoute('获取赛季继承预览失败', async (req, res) => {
    return replyServiceOut(res, await seasonSettlementService.preview(req.params.playerId));
  }),
);

router.get(
  '/:playerId/season-settlement/status',
  withRoute('获取赛季继承状态失败', async (req, res) => {
    return replyServiceOut(res, await seasonSettlementService.getStatus(req.params.playerId));
  }),
);

router.post(
  '/:playerId/season-settlement/confirm',
  withRoute('赛季结算封档失败', async (req, res) => {
    return replyServiceOut(res, await seasonSettlementService.confirm(req.params.playerId, req.body || {}));
  }),
);

router.post(
  '/:playerId/season-settlement/apply',
  withRoute('赛季结算发放失败', async (req, res) => {
    return replyServiceOut(res, await seasonSettlementService.apply(req.params.playerId));
  }),
);

module.exports = router;
