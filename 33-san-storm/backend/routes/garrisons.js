/**
 * 驻守系统API路由
 *
 * 提供驻守配置的CRUD、城市防守者查询
 *
 * @module backend/routes/garrisons
 */

const express = require('express');
const router = express.Router();
const garrisonService = require('../services/garrisonService');
const characterRankService = require('../services/characterRankService');
const Player = require('../models/Player');
const { requireAuth, requireSelf } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation');
const garrisonSchemas = require('../middleware/validationSchemas/garrisons');

router.use(requireAuth);
router.param('playerId', requireSelf());

router.get(
  '/city/:cityId/defenders',
  validateParams(garrisonSchemas.cityIdParam),
  async (req, res, next) => {
    try {
      const { pool } = require('../database/connection');
      const [cityRows] = await pool.query('SELECT faction_id FROM cities WHERE city_id = ?', [req.params.cityId]);
      const ownerFaction = cityRows[0]?.faction_id ?? null;
      const defenders = await garrisonService.getCityDefenders(req.params.cityId, ownerFaction);
      res.json({ success: true, defenders, count: defenders.length });
    } catch (error) {
      return next(wrap500(error, '获取城市防守者失败'));
    }
  },
);

router.get('/stats/cities', async (req, res, next) => {
  try {
    const stats = await garrisonService.getCityGarrisonStats();
    res.json({ success: true, stats });
  } catch (error) {
    return next(wrap500(error, '获取驻守统计失败'));
  }
});

/** 披挂上阵已下线（玩法1重构）；保留路由以免旧客户端 404，统一 410 */
router.get(
  '/city/:cityId/on-duty-count',
  validateParams(garrisonSchemas.cityIdParam),
  (_req, res) => {
    res.status(410).json({
      success: false,
      error: '披挂上阵已移除',
      code: 'ON_DUTY_REMOVED',
      count: 0,
    });
  },
);

router.post(
  '/:playerId/on-duty',
  validateBody(garrisonSchemas.onDutyBody),
  async (req, res, next) => {
    try {
      const { pool } = require('../database/connection');
      // 强制清残留状态，避免旧客户端误开
      await pool.query(
        'UPDATE players SET on_duty = FALSE, on_duty_city_id = NULL WHERE player_id = ?',
        [req.params.playerId],
      );
      res.status(410).json({
        success: false,
        error: '披挂上阵已移除；请使用主城「驻军所」配置驻地编组',
        code: 'ON_DUTY_REMOVED',
        onDuty: false,
      });
    } catch (error) {
      return next(wrap500(error, '披挂上阵已移除'));
    }
  },
);

router.get(
  '/:playerId/by-city/:cityId',
  validateParams(garrisonSchemas.playerCityParams),
  async (req, res, next) => {
    try {
      const garrisons = await garrisonService.getPlayerGarrisonsForCity(
        req.params.playerId,
        req.params.cityId,
      );
      res.json({ success: true, garrisons });
    } catch (error) {
      return next(wrap500(error, '按城获取驻守配置失败'));
    }
  },
);

router.get('/:playerId', async (req, res, next) => {
  try {
    const garrisons = await garrisonService.getPlayerGarrisons(req.params.playerId);
    res.json({ success: true, garrisons });
  } catch (error) {
    return next(wrap500(error, '获取驻守配置失败'));
  }
});

router.get(
  '/:playerId/:slot',
  validateParams(garrisonSchemas.garrisonSlotParams),
  validateQuery(garrisonSchemas.cityIdQuery),
  async (req, res, next) => {
    try {
      const cityId = req.query.cityId;
      const slot = await garrisonService.getGarrisonSlot(
        req.params.playerId,
        cityId,
        parseInt(req.params.slot, 10),
      );
      res.json({ success: true, garrison: slot });
    } catch (error) {
      return next(wrap500(error, '获取驻守槽位失败'));
    }
  },
);

router.post(
  '/:playerId/:slot',
  validateParams(garrisonSchemas.garrisonSlotParams),
  validateBody(garrisonSchemas.saveGarrisonBody),
  async (req, res, next) => {
    try {
      const { playerId, slot } = req.params;
      const slotNumber = parseInt(slot, 10);
      const result = await garrisonService.saveGarrison(playerId, slotNumber, req.body);
      if (!result.success) {
        return res.status(400).json(result);
      }
      characterRankService.refreshSnapshotsForPlayer(playerId).catch(() => {});
      res.json(result);
    } catch (error) {
      return next(wrap500(error, '保存驻守配置失败'));
    }
  },
);

router.delete(
  '/:playerId/:slot',
  validateParams(garrisonSchemas.garrisonSlotParams),
  validateQuery(garrisonSchemas.cityIdQuery),
  async (req, res, next) => {
    try {
      const { playerId } = req.params;
      const cityId = req.query.cityId;
      const result = await garrisonService.clearGarrison(playerId, cityId, parseInt(req.params.slot, 10));
      if (!result.success) {
        return res.status(400).json(result);
      }
      characterRankService.refreshSnapshotsForPlayer(playerId).catch(() => {});
      res.json(result);
    } catch (error) {
      return next(wrap500(error, '清空驻守槽位失败'));
    }
  },
);

module.exports = router;
