/**
 * 探险系统 API（Extra 挂机派遣）
 * @module backend/routes/adventure
 */

const express = require('express');
const router = express.Router();
const adventureService = require('../services/adventureService');
const { requireAuth, requireSelf } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');
const { validateBody, validateParams } = require('../middleware/validation');
const schemas = require('../middleware/validationSchemas/adventure');

router.use(requireAuth);
router.param('playerId', requireSelf());

/** GET /api/adventure/:playerId — 主题列表 + 当前探险（到期自动结算为可领） */
router.get(
  '/:playerId',
  validateParams(schemas.playerParams),
  async (req, res, next) => {
    try {
      const data = await adventureService.getStatus(req.params.playerId);
      res.json(data);
    } catch (error) {
      return next(wrap500(error, '获取探险状态失败'));
    }
  },
);

/** POST /api/adventure/:playerId/dispatch */
router.post(
  '/:playerId/dispatch',
  validateParams(schemas.playerParams),
  validateBody(schemas.dispatchBody),
  async (req, res, next) => {
    try {
      const result = await adventureService.dispatch(req.params.playerId, {
        extraSlot: req.body.extraSlot,
        themeId: req.body.themeId,
      });
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (error) {
      return next(wrap500(error, '派遣探险失败'));
    }
  },
);

/** POST /api/adventure/:playerId/claim */
router.post(
  '/:playerId/claim',
  validateParams(schemas.playerParams),
  validateBody(schemas.claimBody),
  async (req, res, next) => {
    try {
      const result = await adventureService.claim(
        req.params.playerId,
        req.body.adventureId,
      );
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (error) {
      return next(wrap500(error, '领取探险报告失败'));
    }
  },
);

module.exports = router;
