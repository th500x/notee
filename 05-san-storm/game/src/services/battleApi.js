/**
 * 战斗记录 API 服务
 * 
 * @description 提供战斗记录的保存、查询、收藏等API调用
 */

import { API_CONFIG } from '../constants';

/**
 * 带超时的fetch
 */
async function fetchWithTimeout(url, options = {}, timeout = API_CONFIG.TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error('请求超时');
    throw error;
  }
}

export const battleAPI = {
  /**
   * 保存战斗记录
   * @param {Object} battleData - 战斗数据（camelCase）
   * @returns {Promise<Object>} { success, battle } 或 { success: false, error }
   */
  saveBattle: async (battleData) => {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/battles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(battleData),
      });
      const data = await response.json().catch(() => ({}));
      if (data.success) {
        return {
          success: true,
          battle: data.battle,
          veteranPromotions: Array.isArray(data.veteranPromotions) ? data.veteranPromotions : [],
          banditBadgeGranted: data.banditBadgeGranted || null,
          banditBadgeError: data.banditBadgeError || null,
        };
      }
      const detail = [data.message, data.error, data.sqlMessage].filter(Boolean).join(' | ');
      console.warn('[BattleAPI] 保存失败', detail || response.status);
      return {
        success: false,
        error: detail || data.message || '保存失败',
        sqlMessage: data.sqlMessage,
        status: response.status,
      };
    } catch (error) {
      console.error('[BattleAPI] 保存请求失败', error);
      return { success: false, error: '网络错误' };
    }
  },

  /**
   * 获取玩家战斗记录列表
   * @param {string} playerId - 玩家ID
   * @param {string} filter - all/pvp/campaign/event/favorited
   * @returns {Promise<Object>} { success, battles, count }
   */
  getBattles: async (playerId, filter = 'all') => {
    try {
      const params = new URLSearchParams({ playerId, filter });
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/battles?${params}`,
        { method: 'GET' }
      );
      const data = await response.json();
      if (data.success) {
        return { success: true, battles: data.battles, count: data.count };
      }
      return { success: false, error: data.message || '获取失败' };
    } catch (error) {
      console.error('[BattleAPI] 获取战斗记录失败', error);
      return { success: false, error: '网络错误' };
    }
  },

  /**
   * 获取单条战斗详情
   * @param {string} battleId - 战斗ID
   * @returns {Promise<Object>}
   */
  getBattleDetail: async (battleId) => {
    try {
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/battles/${battleId}`,
        { method: 'GET' }
      );
      const data = await response.json();
      if (data.success) {
        return { success: true, battle: data.battle };
      }
      return { success: false, error: data.message || '获取失败' };
    } catch (error) {
      console.error('[BattleAPI] 获取战斗详情失败', error);
      return { success: false, error: '网络错误' };
    }
  },

  /**
   * 收藏战斗
   * @param {string} playerId - 玩家ID
   * @param {string} battleId - 战斗ID
   * @returns {Promise<Object>}
   */
  favoriteBattle: async (playerId, battleId) => {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/battles/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, battleId }),
      });
      return await response.json();
    } catch (error) {
      console.error('[BattleAPI] 收藏失败', error);
      return { success: false, error: '网络错误' };
    }
  },

  /**
   * 取消收藏
   * @param {string} playerId - 玩家ID
   * @param {string} battleId - 战斗ID
   * @returns {Promise<Object>}
   */
  unfavoriteBattle: async (playerId, battleId) => {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/battles/unfavorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, battleId }),
      });
      return await response.json();
    } catch (error) {
      console.error('[BattleAPI] 取消收藏失败', error);
      return { success: false, error: '网络错误' };
    }
  },

  /**
   * 战斗纪念图配额（每天1次）
   */
  getBattleMemorialQuota: async (playerId) => {
    try {
      const params = new URLSearchParams({ playerId });
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/memorial/battle/quota?${params}`, {
        method: 'GET',
      });
      const data = await response.json();
      if (data.success) return { success: true, data: data.data };
      return { success: false, error: data.error || '获取配额失败' };
    } catch (error) {
      console.error('[BattleAPI] 获取纪念图配额失败', error);
      return { success: false, error: '网络错误' };
    }
  },

  /**
   * 生成战斗纪念图
   */
  createBattleMemorial: async ({ playerId, battleId, imageBase64 }) => {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/memorial/battle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, battleId, imageBase64 }),
      });
      const data = await response.json();
      if (data.success) return { success: true, data: data.data };
      return { success: false, error: data.error || '生成失败', code: data.code, data: data.data };
    } catch (error) {
      console.error('[BattleAPI] 生成战斗纪念图失败', error);
      return { success: false, error: '网络错误' };
    }
  },
};
