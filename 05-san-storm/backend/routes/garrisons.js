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

// ── 静态路由（必须在动态 /:playerId 之前） ──

/**
 * GET /api/garrisons/city/:cityId/defenders
 */
router.get('/city/:cityId/defenders', async (req, res) => {
  try {
    const defenders = await garrisonService.getCityDefenders(req.params.cityId);
    res.json({ success: true, defenders, count: defenders.length });
  } catch (error) {
    console.error('[Garrisons] 获取城市防守者失败:', error);
    res.status(500).json({ success: false, error: '获取城市防守者失败' });
  }
});

/**
 * GET /api/garrisons/stats/cities
 */
router.get('/stats/cities', async (req, res) => {
  try {
    const stats = await garrisonService.getCityGarrisonStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('[Garrisons] 获取驻守统计失败:', error);
    res.status(500).json({ success: false, error: '获取驻守统计失败' });
  }
});

/**
 * GET /api/garrisons/city/:cityId/on-duty-count
 */
router.get('/city/:cityId/on-duty-count', async (req, res) => {
  try {
    const { pool } = require('../database/connection');
    const [rows] = await pool.query(
      `SELECT COUNT(DISTINCT pg.player_id) AS count
       FROM player_garrison pg
       JOIN players p ON pg.player_id = p.player_id
       WHERE pg.city_id = ? AND pg.is_active = TRUE AND p.on_duty = TRUE`,
      [req.params.cityId]
    );
    res.json({ success: true, count: rows[0]?.count || 0 });
  } catch (error) {
    console.error('[Garrisons] 获取披挂上阵人数失败:', error);
    res.status(500).json({ success: false, error: '获取披挂上阵人数失败' });
  }
});

// ── 动态路由（:playerId 开头，必须在静态路由之后） ──

/**
 * POST /api/garrisons/:playerId/on-duty
 * 注意：必须在 /:playerId/:slot 之前，否则 "on-duty" 会被当作 slot
 */
router.post('/:playerId/on-duty', async (req, res) => {
  try {
    const { onDuty } = req.body;
    const { pool } = require('../database/connection');
    await pool.query('UPDATE players SET on_duty = ? WHERE player_id = ?', [!!onDuty, req.params.playerId]);
    res.json({ success: true, onDuty: !!onDuty });
  } catch (error) {
    console.error('[Garrisons] 切换披挂上阵失败:', error);
    res.status(500).json({ success: false, error: '切换披挂上阵失败' });
  }
});

/**
 * GET /api/garrisons/:playerId
 * 获取玩家所有驻守配置
 */
router.get('/:playerId', async (req, res) => {
  try {
    const garrisons = await garrisonService.getPlayerGarrisons(req.params.playerId);
    res.json({ success: true, garrisons });
  } catch (error) {
    console.error('[Garrisons] 获取驻守配置失败:', error);
    res.status(500).json({ success: false, error: '获取驻守配置失败' });
  }
});

/**
 * GET /api/garrisons/:playerId/:slot
 * 获取玩家某个槽位的驻守配置
 */
router.get('/:playerId/:slot', async (req, res) => {
  try {
    const slot = await garrisonService.getGarrisonSlot(req.params.playerId, parseInt(req.params.slot));
    res.json({ success: true, garrison: slot });
  } catch (error) {
    console.error('[Garrisons] 获取驻守槽位失败:', error);
    res.status(500).json({ success: false, error: '获取驻守槽位失败' });
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
router.post('/:playerId/:slot', async (req, res) => {
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

    res.json({ success: true });
  } catch (error) {
    console.error('[Garrisons] 保存驻守配置失败:', error);
    res.status(500).json({ success: false, error: '保存驻守配置失败' });
  }
});

/**
 * DELETE /api/garrisons/:playerId/:slot
 * 清空驻守槽位
 */
router.delete('/:playerId/:slot', async (req, res) => {
  try {
    const result = await garrisonService.clearGarrison(req.params.playerId, parseInt(req.params.slot));
    res.json(result);
  } catch (error) {
    console.error('[Garrisons] 清空驻守槽位失败:', error);
    res.status(500).json({ success: false, error: '清空驻守槽位失败' });
  }
});

module.exports = router;
