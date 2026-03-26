/**
 * 战斗记录服务
 * 
 * @description 提供战斗记录的业务逻辑处理
 * @module services/battleService
 */

const Battle = require('../models/Battle');

/**
 * 保存战斗记录
 * @param {Object} battleData - 战斗数据（前端camelCase → 数据库snake_case）
 * @returns {Promise<Object>} 保存的战斗记录
 */
async function saveBattle(battleData) {
  // 前端传入camelCase，转换为模型需要的snake_case
  const data = {
    battle_id: battleData.battleId,
    player_id: battleData.playerId,
    war_id: battleData.warId || null,
    battle_type: battleData.battleType,
    opponent_type: battleData.opponentType,
    opponent_id: battleData.opponentId || null,
    opponent_name: battleData.opponentName || null,
    result: battleData.result,
    player_team: battleData.playerTeam || null,
    opponent_team: battleData.opponentTeam || null,
    battle_log: battleData.battleLog || null,
    total_damage_dealt: battleData.totalDamageDealt || null,
    total_damage_taken: battleData.totalDamageTaken || null,
    total_kills: battleData.totalKills || null,
    duration: battleData.duration || null,
    rewards: battleData.rewards || null,
  };

  return await Battle.create(data);
}

/**
 * 获取玩家战斗记录列表
 * @param {string} playerId - 玩家ID
 * @param {string} filter - 筛选类型：all/pvp/campaign/event/favorited
 * @returns {Promise<Array>}
 */
async function getBattles(playerId, filter = 'all') {
  return await Battle.getByPlayerId(playerId, { filter });
}

/**
 * 获取单条战斗记录详情
 * @param {string} battleId - 战斗ID
 * @returns {Promise<Object|null>}
 */
async function getBattleDetail(battleId) {
  return await Battle.getById(battleId);
}

/**
 * 收藏战斗
 * @param {string} playerId - 玩家ID
 * @param {string} battleId - 战斗ID
 * @returns {Promise<Object>} { success, message }
 */
async function favoriteBattle(playerId, battleId) {
  const canFav = await Battle.canFavorite(playerId);
  if (!canFav) {
    return { success: false, message: '最多只能收藏50场战斗' };
  }

  const ok = await Battle.favorite(playerId, battleId);
  if (!ok) {
    return { success: false, message: '战斗记录不存在或无权操作' };
  }

  return { success: true, message: '收藏成功' };
}

/**
 * 取消收藏
 * @param {string} playerId - 玩家ID
 * @param {string} battleId - 战斗ID
 * @returns {Promise<Object>} { success, message }
 */
async function unfavoriteBattle(playerId, battleId) {
  const ok = await Battle.unfavorite(playerId, battleId);
  if (!ok) {
    return { success: false, message: '战斗记录不存在或无权操作' };
  }

  return { success: true, message: '已取消收藏，日志将在14天后过期' };
}

module.exports = {
  saveBattle,
  getBattles,
  getBattleDetail,
  favoriteBattle,
  unfavoriteBattle,
};
