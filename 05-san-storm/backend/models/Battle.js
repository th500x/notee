/**
 * 战斗记录数据模型
 * 
 * @description 处理战斗记录相关的数据库操作
 */

const { pool } = require('../database/connection');

class Battle {
  /**
   * 创建战斗记录
   * @param {Object} data - 战斗数据
   * @returns {Promise<Object>} 创建的战斗记录
   */
  static async create(data) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14天后过期

    /** TEXT 上限 65535；战役长日志略超出会致 INSERT 失败（生产曾出现战报落库 500） */
    const BATTLE_LOG_MAX = 65000;
    let log = data.battle_log || null;
    if (typeof log === 'string' && log.length > BATTLE_LOG_MAX) {
      log = `${log.slice(0, BATTLE_LOG_MAX - 80)}\n…[battle_log 已截断 ${log.length - BATTLE_LOG_MAX + 80} 字符]`;
    }

    await pool.query(`
      INSERT INTO battles (
        battle_id, player_id, war_id, pvp_war_id,
        battle_type, opponent_type, opponent_id, opponent_name,
        result,
        player_team, opponent_team, battle_log,
        total_damage_dealt, total_damage_taken, total_kills, duration,
        rewards,
        is_favorited, log_expires_at, battle_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?,
        FALSE, ?, NOW()
      )
    `, [
      data.battle_id,
      data.player_id,
      data.war_id || null,
      data.pvp_war_id || null,
      data.battle_type,
      data.opponent_type,
      data.opponent_id || null,
      data.opponent_name || null,
      data.result,
      JSON.stringify(data.player_team || null),
      JSON.stringify(data.opponent_team || null),
      log,
      data.total_damage_dealt || null,
      data.total_damage_taken || null,
      data.total_kills || null,
      data.duration || null,
      JSON.stringify(data.rewards || null),
      expiresAt
    ]);

    return await this.getById(data.battle_id);
  }

  /**
   * 根据ID获取战斗记录
   * @param {string} battleId - 战斗ID
   * @returns {Promise<Object|null>}
   */
  static async getById(battleId) {
    const [rows] = await pool.query(
      'SELECT * FROM battles WHERE battle_id = ?',
      [battleId]
    );
    return rows.length > 0 ? this.formatRow(rows[0]) : null;
  }

  /**
   * 获取玩家的战斗记录列表
   * @param {string} playerId - 玩家ID
   * @param {Object} filters - 筛选条件
   * @param {string} filters.filter - all/pvp/campaign/event/favorited
   * @param {number} filters.limit - 返回数量限制
   * @returns {Promise<Array>}
   */
  static async getByPlayerId(playerId, filters = {}) {
    const { filter = 'all', limit = 50 } = filters;

    let whereClause = 'WHERE player_id = ?';
    const params = [playerId];

    if (filter === 'pvp') {
      whereClause += " AND battle_type LIKE 'pvp_%'";
    } else if (filter === 'campaign') {
      whereClause += " AND battle_type = 'pve_campaign'";
    } else if (filter === 'event') {
      whereClause += " AND battle_type IN ('pve_event','pve_siege')";
    } else if (filter === 'favorited') {
      whereClause += ' AND is_favorited = TRUE';
    }

    const [rows] = await pool.query(`
      SELECT 
        battle_id, player_id, war_id, pvp_war_id,
        battle_type, opponent_type, opponent_id, opponent_name,
        result,
        player_team, opponent_team,
        CASE WHEN battle_log IS NOT NULL THEN TRUE ELSE FALSE END as has_log,
        total_damage_dealt, total_damage_taken, total_kills, duration,
        rewards,
        is_favorited, log_expires_at, battle_at
      FROM battles
      ${whereClause}
      ORDER BY is_favorited DESC, battle_at DESC
      LIMIT ?
    `, [...params, limit]);

    return rows.map(row => this.formatRow(row));
  }

  /**
   * 收藏战斗
   * @param {string} playerId - 玩家ID
   * @param {string} battleId - 战斗ID
   * @returns {Promise<boolean>} 是否成功
   */
  static async favorite(playerId, battleId) {
    const [result] = await pool.query(`
      UPDATE battles
      SET is_favorited = TRUE
      WHERE battle_id = ? AND player_id = ?
    `, [battleId, playerId]);
    return result.affectedRows > 0;
  }

  /**
   * 取消收藏（重新设置14天过期）
   * @param {string} playerId - 玩家ID
   * @param {string} battleId - 战斗ID
   * @returns {Promise<boolean>} 是否成功
   */
  static async unfavorite(playerId, battleId) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const [result] = await pool.query(`
      UPDATE battles
      SET is_favorited = FALSE, log_expires_at = ?
      WHERE battle_id = ? AND player_id = ?
    `, [expiresAt, battleId, playerId]);
    return result.affectedRows > 0;
  }

  /**
   * 检查玩家是否可以收藏（最多50场）
   * @param {string} playerId - 玩家ID
   * @returns {Promise<boolean>}
   */
  static async canFavorite(playerId) {
    const [rows] = await pool.query(`
      SELECT COUNT(*) as count
      FROM battles
      WHERE player_id = ? AND is_favorited = TRUE
    `, [playerId]);
    return rows[0].count < 50;
  }

  /**
   * 清理过期日志（将battle_log设为NULL）
   * @returns {Promise<number>} 清理的记录数
   */
  static async cleanExpiredLogs() {
    const [result] = await pool.query(`
      UPDATE battles
      SET battle_log = NULL
      WHERE log_expires_at < NOW()
        AND is_favorited = FALSE
        AND battle_log IS NOT NULL
    `);
    return result.affectedRows;
  }

  /**
   * 格式化数据库行 → 前端格式
   * @param {Object} row - 数据库行
   * @returns {Object}
   */
  static formatRow(row) {
    const parseJSON = (val) => {
      if (!val) return null;
      if (typeof val === 'object') return val;
      try { return JSON.parse(val); } catch { return null; }
    };

    return {
      battleId: row.battle_id,
      playerId: row.player_id,
      warId: row.war_id || null,
      pvpWarId: row.pvp_war_id || null,
      battleType: row.battle_type,
      opponentType: row.opponent_type,
      opponentId: row.opponent_id || null,
      opponentName: row.opponent_name || null,
      result: row.result,
      playerTeam: parseJSON(row.player_team),
      opponentTeam: parseJSON(row.opponent_team),
      battleLog: row.battle_log !== undefined ? row.battle_log : undefined,
      hasLog: row.has_log !== undefined ? !!row.has_log : undefined,
      totalDamageDealt: row.total_damage_dealt,
      totalDamageTaken: row.total_damage_taken,
      totalKills: row.total_kills,
      duration: row.duration,
      rewards: parseJSON(row.rewards),
      isFavorited: !!row.is_favorited,
      logExpiresAt: row.log_expires_at,
      battleAt: row.battle_at,
    };
  }
}

module.exports = Battle;
