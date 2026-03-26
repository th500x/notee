/**
 * 卡池抽取 API 服务
 * 
 * @module game/services/cardPoolApi
 */

import { API_CONFIG } from '../constants';

async function fetchWithTimeout(url, options = {}, timeout = API_CONFIG.TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error('请求超时，请检查网络连接');
    throw error;
  }
}

export const cardPoolAPI = {
  /**
   * 获取卡池状态（剩余次数、保底进度、银两）
   */
  getStatus: async (playerId) => {
    try {
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/card-pool/status/${playerId}`,
        { method: 'GET' }
      );
      return await response.json();
    } catch (error) {
      console.error('[CardPoolAPI] 获取卡池状态失败', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 抽取卡牌
   * @param {string} playerId
   * @param {'troop'|'character'} poolType
   */
  draw: async (playerId, poolType) => {
    try {
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/card-pool/draw`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, poolType }),
        }
      );
      return await response.json();
    } catch (error) {
      console.error('[CardPoolAPI] 抽取失败', error);
      return { success: false, error: error.message };
    }
  },
};
