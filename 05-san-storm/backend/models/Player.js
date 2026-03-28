/**
 * 玩家数据模型
 * 
 * @description 处理玩家角色相关的数据库操作
 */

const { pool } = require('../database/connection');

class Player {
  /**
   * 检查玩家是否存在
   * @param {string} playerId - 玩家ID
   * @returns {Promise<boolean>}
   */
  static async exists(playerId) {
    const [rows] = await pool.query(
      'SELECT player_id FROM players WHERE player_id = ?',
      [playerId]
    );
    return rows.length > 0;
  }

  /**
   * 获取玩家信息
   * @param {string} playerId - 玩家ID
   * @returns {Promise<Object|null>}
   */
  static async getById(playerId) {
    const [rows] = await pool.query(
      'SELECT * FROM players WHERE player_id = ?',
      [playerId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 创建玩家角色
   * @param {Object} playerData - 玩家数据
   * @returns {Promise<Object>}
   */
  static async create(playerData) {
      const {
        player_id,
        character_name,
        faction_id,
        faction_name,
        avatar,
        // 属性（已×10）
        combat,
        intelligence,
        command,
        politics,
        charm,
        courage,
        luck,
        // 技能
        skill_1,
        skill_2,
        // 初始官职（可为null）
        current_position_id,
        current_position_name,
        position_level,
        // 初始资源
        initial_silver = 0,
        initial_food = 0
      } = playerData;

      // 插入玩家数据
      await pool.query(`
        INSERT INTO players (
          player_id, character_name, faction_id, faction_name, avatar,
          combat, intelligence, command, politics, charm, courage, luck,
          skill_1, skill_2,
          current_position_id, current_position_name, position_level,
          reputation, reputation_to_next,
          silver, food,
          created_at, last_login_at, last_active_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          0, 10,
          ?, ?,
          NOW(), NOW(), NOW()
        )
      `, [
        player_id, character_name, faction_id, faction_name, avatar || null,
        combat, intelligence, command, politics, charm, courage, luck,
        skill_1 || null, skill_2 || null,
        current_position_id, current_position_name, position_level,
        initial_silver,
        initial_food
      ]);

      // 创建玩家进度表
      await pool.query(`
        INSERT INTO player_progress (player_id, tutorial_completed, tutorial_current_step)
        VALUES (?, FALSE, 1)
      `, [player_id]);

      // 创建玩家事件进度表
      await pool.query(`
        INSERT INTO player_events (player_id)
        VALUES (?)
      `, [player_id]);

      // 创建玩家统计表
      await pool.query(`
        INSERT INTO statistics (player_id)
        VALUES (?)
      `, [player_id]);

      return await this.getById(player_id);
    }


  /**
   * 检查角色名是否已被使用
   * @param {string} characterName - 角色名
   * @param {string} serverId - 服务器ID
   * @returns {Promise<boolean>}
   */
  static async isNameTaken(characterName, serverId) {
    // 查询同服务器内是否有同名角色
    const [rows] = await pool.query(`
      SELECT p.player_id 
      FROM players p
      JOIN accounts a ON p.player_id = a.id
      WHERE p.character_name = ? AND a.serverId = ?
    `, [characterName, serverId]);
    return rows.length > 0;
  }

  /**
   * 更新玩家最后活跃时间
   * @param {string} playerId - 玩家ID
   */
  static async updateLastActive(playerId) {
    await pool.query(`
      UPDATE players 
      SET last_active_at = NOW()
      WHERE player_id = ?
    `, [playerId]);
  }

  /**
   * 更新玩家属性
   * @param {string} playerId - 玩家ID
   * @param {Object} attributes - 属性对象
   */
  static async updateAttributes(playerId, attributes) {
    const fields = [];
    const values = [];

    Object.entries(attributes).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });

    if (fields.length === 0) return;

    values.push(playerId);

    await pool.query(`
      UPDATE players 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE player_id = ?
    `, values);
  }

  /**
   * 更新玩家资源
   * @param {string} playerId - 玩家ID
   * @param {Object} resources - 资源对象 {silver, food, reputation, contribution}
   */
  static async updateResources(playerId, resources) {
    const fields = [];
    const values = [];

    if (resources.silver !== undefined) {
      fields.push('silver = silver + ?');
      values.push(resources.silver);
    }
    if (resources.food !== undefined) {
      fields.push('food = food + ?');
      values.push(resources.food);
    }
    if (resources.reputation !== undefined) {
      fields.push('reputation = reputation + ?');
      values.push(resources.reputation);
    }
    if (resources.contribution !== undefined) {
      fields.push('contribution = contribution + ?');
      values.push(resources.contribution);
    }

    if (fields.length === 0) return;

    values.push(playerId);

    await pool.query(`
      UPDATE players 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE player_id = ?
    `, values);
  }
}

module.exports = Player;
