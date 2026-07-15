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

router.get(
  '/city/:cityId/on-duty-count',
  validateParams(garrisonSchemas.cityIdParam),
  async (req, res, next) => {
    try {
      const { pool } = require('../database/connection');
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS count
       FROM players p
       INNER JOIN cities c ON c.city_id = ?
       WHERE p.on_duty = TRUE
         AND p.on_duty_city_id = ?
         AND c.faction_id IS NOT NULL
         AND p.faction_id = c.faction_id`,
        [req.params.cityId, req.params.cityId],
      );
      res.json({ success: true, count: rows[0]?.count || 0 });
    } catch (error) {
      return next(wrap500(error, '获取披挂上阵人数失败'));
    }
  },
);

router.post(
  '/:playerId/on-duty',
  validateBody(garrisonSchemas.onDutyBody),
  async (req, res, next) => {
    try {
      const { onDuty, cityId } = req.body;
      const { pool } = require('../database/connection');
      const playerId = req.params.playerId;

      if (onDuty) {
        if (!cityId) {
          return res.status(400).json({
            success: false,
            error: '开启披挂上阵需传入 cityId（待战目标城池）',
          });
        }
        const [pRows] = await pool.query('SELECT faction_id FROM players WHERE player_id = ?', [playerId]);
        const playerRow = pRows[0];
        if (!playerRow) {
          return res.status(404).json({ success: false, error: '玩家不存在' });
        }
        const [cRows] = await pool.query('SELECT faction_id FROM cities WHERE city_id = ?', [cityId]);
        const cityRow = cRows[0];
        if (!cityRow) {
          return res.status(400).json({ success: false, error: '城池不存在' });
        }
        if (!cityRow.faction_id || playerRow.faction_id !== cityRow.faction_id) {
          return res.status(400).json({
            success: false,
            error: '仅能为自己势力已占领的城池披挂上阵',
          });
        }
        await pool.query(
          'UPDATE players SET on_duty = TRUE, on_duty_city_id = ? WHERE player_id = ?',
          [cityId, playerId],
        );
      } else {
        await pool.query(
          'UPDATE players SET on_duty = FALSE, on_duty_city_id = NULL WHERE player_id = ?',
          [playerId],
        );
      }
      await Player.updateLastActive(playerId);
      res.json({ success: true, onDuty: !!onDuty });
    } catch (error) {
      return next(wrap500(error, '切换披挂上阵失败'));
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
