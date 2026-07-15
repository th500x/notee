/**
 * 上阵编组 Extra API
 * @module backend/routes/lineupExtra
 */

const express = require('express');
const router = express.Router();
const lineupExtraService = require('../services/lineupExtraService');
const { requireAuth, requireSelf } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');
const { validateBody, validateParams } = require('../middleware/validation');
const schemas = require('../middleware/validationSchemas/lineupExtra');

router.use(requireAuth);
router.param('playerId', requireSelf());

router.get('/:playerId', async (req, res, next) => {
  try {
    const lineups = await lineupExtraService.getAll(req.params.playerId);
    res.json({ success: true, lineups });
  } catch (error) {
    return next(wrap500(error, '获取上阵 Extra 失败'));
  }
});

router.get(
  '/:playerId/:slot',
  validateParams(schemas.playerSlotParams),
  async (req, res, next) => {
    try {
      const lineup = await lineupExtraService.getSlot(
        req.params.playerId,
        parseInt(req.params.slot, 10),
      );
      res.json({ success: true, lineup: lineup || null });
    } catch (error) {
      return next(wrap500(error, '获取上阵 Extra 槽位失败'));
    }
  },
);

router.post(
  '/:playerId/:slot',
  validateParams(schemas.playerSlotParams),
  validateBody(schemas.saveBody),
  async (req, res, next) => {
    try {
      const result = await lineupExtraService.saveSlot(
        req.params.playerId,
        parseInt(req.params.slot, 10),
        req.body,
      );
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (error) {
      return next(wrap500(error, '保存上阵 Extra 失败'));
    }
  },
);

router.delete(
  '/:playerId/:slot',
  validateParams(schemas.playerSlotParams),
  async (req, res, next) => {
    try {
      const result = await lineupExtraService.clearSlot(
        req.params.playerId,
        parseInt(req.params.slot, 10),
      );
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (error) {
      return next(wrap500(error, '清空上阵 Extra 失败'));
    }
  },
);

module.exports = router;
