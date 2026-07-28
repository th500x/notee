/**
 * 玩家路由 · 三公府（O3-B1）
 */
const express = require('express');
const positionPromotionService = require('../../services/positionPromotionService');
const sanGongTributeService = require('../../services/sanGongTributeService');
const sanGongResourceExchangeService = require('../../services/sanGongResourceExchangeService');
const sanGongGiftBoxService = require('../../services/sanGongGiftBoxService');
const sanGongArmamentService = require('../../services/sanGongArmamentService');
const sanGongDocumentService = require('../../services/sanGongDocumentService');
const factionBulletinService = require('../../services/factionBulletinService');
const pvpWarService = require('../../services/pvpWarService');
const cityService = require('../../services/cityService');
const { validateBody, validateParams, validateQuery } = require('../../middleware/validation');
const sanGongSchemas = require('../../middleware/validationSchemas/playersSanGongFu');
const { replyServiceOut, withRoute } = require('../../utils/routeAdapter');

const router = express.Router();

router.get('/:playerId/san-gong-fu/promotions', withRoute('获取晋升列表失败', async (req, res) => {
  return replyServiceOut(res, await positionPromotionService.getPromotionsForPlayer(req.params.playerId));
}));

router.post(
  '/:playerId/san-gong-fu/promote',
  validateBody(sanGongSchemas.promoteBody),
  withRoute('晋升失败', async (req, res) => {
    return replyServiceOut(res, await positionPromotionService.promotePlayer(req.params.playerId, req.body.positionId));
  }),
);

router.post(
  '/:playerId/san-gong-fu/switch-peer-position',
  validateBody(sanGongSchemas.switchPeerBody),
  withRoute('同级官职切换失败', async (req, res) => {
    return replyServiceOut(
      res,
      await positionPromotionService.switchPeerPosition(req.params.playerId, req.body.positionId),
    );
  }),
);

router.get('/:playerId/san-gong-fu/tribute-status', withRoute('朝贡额度查询失败', async (req, res) => {
  const data = await sanGongTributeService.getTributeDailyStatus(req.params.playerId);
  res.json({ success: true, data });
}));

router.post(
  '/:playerId/san-gong-fu/tribute',
  validateBody(sanGongSchemas.tributeBody),
  withRoute('朝贡失败', async (req, res) => {
    const cardType = req.body.cardType === 'character' ? 'character' : 'troop';
    const out = await sanGongTributeService.submitCardTribute(req.params.playerId, req.body.instanceIds, cardType);
    if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
    res.json({ success: true, data: out });
  }),
);

router.get('/:playerId/san-gong-fu/resource-exchange-preview', withRoute('兑换预览失败', async (req, res) => {
  const out = await sanGongResourceExchangeService.getExchangePreview(req.params.playerId);
  if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
  res.json({ success: true, data: out.data });
}));

router.post(
  '/:playerId/san-gong-fu/resource-exchange',
  validateBody(sanGongSchemas.resourceExchangeBody),
  withRoute('银粮兑换失败', async (req, res) => {
    const out = await sanGongResourceExchangeService.submitExchange(
      req.params.playerId,
      req.body.packId,
    );
    if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
    res.json({ success: true, data: out.data });
  }),
);

router.get('/:playerId/san-gong-fu/gift-box-preview', withRoute('礼盒预览失败', async (req, res) => {
  const out = await sanGongGiftBoxService.getGiftBoxPreview(req.params.playerId);
  if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
  res.json({ success: true, data: out.data });
}));

router.post(
  '/:playerId/san-gong-fu/gift-box',
  validateBody(sanGongSchemas.giftBoxBody),
  withRoute('礼盒兑换失败', async (req, res) => {
    const out = await sanGongGiftBoxService.submitGiftBoxRedemption(
      req.params.playerId,
      req.body.treasureId,
    );
    if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
    res.json({ success: true, data: out.data });
  }),
);

router.get('/:playerId/san-gong-fu/armament-preview', withRoute('军备预览失败', async (req, res) => {
  const out = await sanGongArmamentService.getArmamentPreview(req.params.playerId);
  if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
  res.json({ success: true, data: out.data });
}));

router.post(
  '/:playerId/san-gong-fu/armament',
  validateBody(sanGongSchemas.armamentBody),
  withRoute('军备兑换失败', async (req, res) => {
    const out = await sanGongArmamentService.submitArmamentRedemption(
      req.params.playerId,
      req.body.offerId,
    );
    if (!out.ok) return res.status(out.status).json({ success: false, error: out.error });
    res.json({ success: true, data: out.data });
  }),
);

router.get('/:playerId/san-gong-fu/pvp-attacking-wars', withRoute('查询势力战事失败', async (req, res) => {
  const data = await pvpWarService.listSanGongAttackingSiegeWarsForPlayer(req.params.playerId);
  res.json({ success: true, data });
}));

router.post(
  '/:playerId/san-gong-fu/pvp-attacking-wars/:pvpWarId/cancel',
  validateParams(sanGongSchemas.pvpWarIdParam),
  validateBody(sanGongSchemas.cancelWarBody),
  withRoute('结束势力战事失败', async (req, res) => {
    const data = await pvpWarService.cancelAttackingSiegeWarViaSanGongChaoZheng(
      req.params.playerId,
      req.params.pvpWarId,
      req.body,
    );
    res.json({ success: true, data });
  }),
);

router.post(
  '/:playerId/san-gong-fu/pve-attacking-wars/:warId/cancel',
  validateParams(sanGongSchemas.pveWarIdParam),
  validateBody(sanGongSchemas.cancelWarBody),
  withRoute('结束中立城攻城战事失败', async (req, res) => {
    const data = await cityService.cancelActivePveSiegeWarViaSanGongChaoZheng(
      req.params.playerId,
      req.params.warId,
      req.body,
    );
    res.json({ success: true, data });
  }),
);

router.get(
  '/:playerId/san-gong-fu/bulletin',
  validateQuery(sanGongSchemas.bulletinQuery),
  withRoute('获取三公府公告失败', async (req, res) => {
    const limitPerCategory = Math.min(50, Math.max(1, Number(req.query.limitPerCategory) || 30));
    const out = await factionBulletinService.getSanGongGroupedBulletinForPlayer(req.params.playerId, {
      limitPerCategory,
    });
    if (out.notFound) return res.status(404).json({ success: false, error: out.error });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: out.data });
  }),
);

router.get('/:playerId/san-gong-fu/document-status', withRoute('获取文书发布状态失败', async (req, res) => {
  const status = await sanGongDocumentService.getDocumentDailyStatus(req.params.playerId);
  res.json({ success: true, data: status });
}));

router.post(
  '/:playerId/san-gong-fu/document',
  validateBody(sanGongSchemas.documentBody),
  withRoute('发布文书失败', async (req, res) => {
    return replyServiceOut(res, await sanGongDocumentService.postDocument(req.params.playerId, req.body.body));
  }),
);

module.exports = router;
