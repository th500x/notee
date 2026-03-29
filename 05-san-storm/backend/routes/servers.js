/**
 * 服务器路由
 * 
 * @description 处理服务器列表和详情查询
 */

const express = require('express');
const { pool } = require('../database/connection');
const gameTimeService = require('../services/gameTimeService');

const router = express.Router();

/**
 * GET /api/servers/:serverId/game-time
 * 当前游戏历法（config_servers + 实时计算）
 */
router.get('/:serverId/game-time', async (req, res) => {
  try {
    const { serverId } = req.params;
    const fullSelect = `SELECT server_id, opened_at, season_start_time,
              game_time_start_year, game_time_start_month, game_time_start_day,
              game_time_real_hours_per_game_day
       FROM config_servers WHERE server_id = ?`;
    let rows;
    try {
      [rows] = await pool.query(fullSelect, [serverId]);
    } catch (e) {
      if (e.code === 'ER_BAD_FIELD_ERROR' || /Unknown column/i.test(e.message || '')) {
        [rows] = await pool.query(
          'SELECT server_id, opened_at, season_start_time FROM config_servers WHERE server_id = ?',
          [serverId]
        );
      } else {
        throw e;
      }
    }
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '服务器不存在' });
    }
    const gameTime = gameTimeService.computeGameTimeFromServerRow(rows[0]);
    if (!gameTime) {
      return res.status(500).json({
        success: false,
        error: '无法计算游戏时间（缺少 opened_at / season_start_time）',
      });
    }
    res.json({ success: true, data: gameTime });
  } catch (error) {
    console.error('[Servers] game-time 失败:', error);
    res.status(500).json({
      success: false,
      error: '获取游戏时间失败',
      message: error.message,
    });
  }
});

/**
 * GET /api/servers
 * 获取服务器列表（包含实时人数统计）
 */
router.get('/', async (req, res) => {
  try {
    // 查询服务器列表，并统计每个服务器的玩家数
    const [servers] = await pool.query(`
      SELECT 
        s.server_id as id,
        s.server_name as name,
        s.server_icon as icon,
        s.server_color as color,
        s.description,
        s.current_season as season,
        s.season_start_time as seasonStartTime,
        s.season_end_time as seasonEndTime,
        s.max_real_players as maxPlayers,
        s.max_ai_players as maxAiPlayers,
        s.status,
        s.is_new as isNew,
        s.is_recommended as isRecommended,
        s.opened_at as openedAt,
        COALESCE(COUNT(a.id), 0) as activePlayerCount,
        COALESCE(COUNT(CASE WHEN a.status = 'active' AND a.lastActiveAt >= DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN 1 END), 0) as onlinePlayerCount
      FROM config_servers s
      LEFT JOIN accounts a ON s.server_id = a.serverId AND a.current_season = s.current_season
      WHERE s.status != 'closed'
      GROUP BY s.server_id
      ORDER BY s.is_recommended DESC, s.opened_at DESC
    `);

    res.json({ 
      success: true,
      data: servers,
      total: servers.length
    });

  } catch (error) {
    console.error('[Servers] 获取服务器列表失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取服务器列表失败',
      message: error.message 
    });
  }
});

/**
 * GET /api/servers/:serverId
 * 获取服务器详情（包含实时人数统计）
 */
router.get('/:serverId', async (req, res) => {
  try {
    const { serverId } = req.params;

    // 查询服务器详情
    const [servers] = await pool.query(`
      SELECT 
        s.server_id as id,
        s.server_name as name,
        s.server_icon as icon,
        s.server_color as color,
        s.description,
        s.current_season as season,
        s.season_start_time as seasonStartTime,
        s.season_end_time as seasonEndTime,
        s.max_real_players as maxPlayers,
        s.max_ai_players as maxAiPlayers,
        s.status,
        s.is_new as isNew,
        s.is_recommended as isRecommended,
        s.opened_at as openedAt,
        COALESCE(COUNT(a.id), 0) as activePlayerCount,
        COALESCE(COUNT(CASE WHEN a.status = 'active' AND a.lastActiveAt >= DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN 1 END), 0) as onlinePlayerCount
      FROM config_servers s
      LEFT JOIN accounts a ON s.server_id = a.serverId AND a.current_season = s.current_season
      WHERE s.server_id = ?
      GROUP BY s.server_id
    `, [serverId]);

    if (servers.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: '服务器不存在'
      });
    }

    res.json({ 
      success: true,
      data: servers[0]
    });

  } catch (error) {
    console.error('[Servers] 获取服务器详情失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取服务器详情失败',
      message: error.message 
    });
  }
});

module.exports = router;
