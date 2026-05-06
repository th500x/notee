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

/**
 * 鉴权（必改 #1）：本路由全部接口要求合法 JWT；URL 含 `:playerId` 的路由须 token.sub 与之匹配。
 * 仅查城防御者 / 全局统计的接口（`/city/:cityId/defenders`、`/stats/cities` 等）也要求登录，
 * 防止未登录爬库；这与玩法一致——任何"看城防"操作都需要在游戏内进行。
 */
router.use(requireAuth);
router.param('playerId', requireSelf());

// ── 静态路由（必须在动态 /:playerId 之前） ──

/**
 * GET /api/garrisons/city/:cityId/defenders
 * 仅返回 **当前** 整编兵力 ≥ `garrisonService.MIN_GARRISON_TOTAL_TROOPS`（800）的驻地槽；
 * 与 `initiateSiege`、大地图驻地统计同一口径，勿改回仅依赖 `is_active`。
 */
router.get('/city/:cityId/defenders', async (req, res, next) => {
  try {
    const { pool } = require('../database/connection');
    const [cityRows] = await pool.query('SELECT faction_id FROM cities WHERE city_id = ?', [req.params.cityId]);
    const ownerFaction = cityRows[0]?.faction_id ?? null;
    const defenders = await garrisonService.getCityDefenders(req.params.cityId, ownerFaction);
    res.json({ success: true, defenders, count: defenders.length });
  } catch (error) {
    return next(wrap500(error, '获取城市防守者失败'));
  }
});

/**
 * GET /api/garrisons/stats/cities
 * `slot_count` 仅计当前整编兵力 ≥ 800 的槽位（与攻城、defenders 一致）。
 */
router.get('/stats/cities', async (req, res, next) => {
  try {
    const stats = await garrisonService.getCityGarrisonStats();
    res.json({ success: true, stats });
  } catch (error) {
    return next(wrap500(error, '获取驻守统计失败'));
  }
});

/**
 * GET /api/garrisons/city/:cityId/on-duty-count
 */
router.get('/city/:cityId/on-duty-count', async (req, res, next) => {
  try {
    const { pool } = require('../database/connection');
    // 与驻地守军统计无关：只计「选择披挂上阵」且待战目标为本城、与城同势力的玩家
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM players p
       INNER JOIN cities c ON c.city_id = ?
       WHERE p.on_duty = TRUE
         AND p.on_duty_city_id = ?
         AND c.faction_id IS NOT NULL
         AND p.faction_id = c.faction_id`,
      [req.params.cityId, req.params.cityId]
    );
    res.json({ success: true, count: rows[0]?.count || 0 });
  } catch (error) {
    return next(wrap500(error, '获取披挂上阵人数失败'));
  }
});

// ── 动态路由（:playerId 开头，必须在静态路由之后） ──

/**
 * POST /api/garrisons/:playerId/on-duty
 * 注意：必须在 /:playerId/:slot 之前，否则 "on-duty" 会被当作 slot
 */
router.post('/:playerId/on-duty', async (req, res, next) => {
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
        [cityId, playerId]
      );
    } else {
      await pool.query(
        'UPDATE players SET on_duty = FALSE, on_duty_city_id = NULL WHERE player_id = ?',
        [playerId]
      );
    }
    await Player.updateLastActive(playerId);
    res.json({ success: true, onDuty: !!onDuty });
  } catch (error) {
    return next(wrap500(error, '切换披挂上阵失败'));
  }
});

/**
 * GET /api/garrisons/:playerId/by-city/:cityId
 * 获取玩家在某城的驻地槽位（须在 /:playerId/:slot 之前注册，避免 by-city 被当成 slot）
 */
router.get('/:playerId/by-city/:cityId', async (req, res, next) => {
  try {
    const garrisons = await garrisonService.getPlayerGarrisonsForCity(
      req.params.playerId,
      req.params.cityId
    );
    res.json({ success: true, garrisons });
  } catch (error) {
    return next(wrap500(error, '按城获取驻守配置失败'));
  }
});

/**
 * GET /api/garrisons/:playerId
 * 获取玩家所有驻守配置
 */
router.get('/:playerId', async (req, res, next) => {
  try {
    const garrisons = await garrisonService.getPlayerGarrisons(req.params.playerId);
    res.json({ success: true, garrisons });
  } catch (error) {
    return next(wrap500(error, '获取驻守配置失败'));
  }
});

/**
 * GET /api/garrisons/:playerId/:slot
 * 获取玩家某个槽位的驻守配置
 */
router.get('/:playerId/:slot', async (req, res, next) => {
  try {
    const cityId = req.query.cityId;
    if (!cityId || String(cityId).trim() === '') {
      return res.status(400).json({ success: false, error: '缺少查询参数 cityId' });
    }
    const slot = await garrisonService.getGarrisonSlot(
      req.params.playerId,
      cityId,
      parseInt(req.params.slot, 10)
    );
    res.json({ success: true, garrison: slot });
  } catch (error) {
    return next(wrap500(error, '获取驻守槽位失败'));
  }
});

/**
 * POST /api/garrisons/:playerId/:slot
 * 保存驻守配置
 * 
 * body: {
 *   cityId, cityName,
 *   char1_card, char1_equipment_card, char1_title, char1_achievement, char1_treasure, char1_troop1, char1_troop2,
 *   char2_card, char2_equipment_card, char2_title, char2_achievement, char2_treasure, char2_troop1, char2_troop2
 * }
 */
router.post('/:playerId/:slot', async (req, res, next) => {
  try {
    const { playerId, slot } = req.params;
    const slotNumber = parseInt(slot);

    if (slotNumber < 1 || slotNumber > 12) {
      return res.status(400).json({ success: false, error: '槽位编号必须在1-12之间' });
    }

    const result = await garrisonService.saveGarrison(playerId, slotNumber, req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }

    characterRankService.refreshSnapshotsForPlayer(playerId).catch(() => {});
    res.json(result);
  } catch (error) {
    return next(wrap500(error, '保存驻守配置失败'));
  }
});

/**
 * DELETE /api/garrisons/:playerId/:slot
 * 清空驻守槽位
 */
router.delete('/:playerId/:slot', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const cityId = req.query.cityId;
    if (!cityId || String(cityId).trim() === '') {
      return res.status(400).json({ success: false, error: '缺少查询参数 cityId' });
    }
    const result = await garrisonService.clearGarrison(playerId, cityId, parseInt(req.params.slot, 10));
    if (!result.success) {
      return res.status(400).json(result);
    }
    characterRankService.refreshSnapshotsForPlayer(playerId).catch(() => {});
    res.json(result);
  } catch (error) {
    return next(wrap500(error, '清空驻守槽位失败'));
  }
});

module.exports = router;
