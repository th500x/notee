/**
 * 卡池抽取 API 服务
 * 
 * @module game/services/cardPoolApi
 */

import { API_CONFIG } from '../constants';
import { fetchWithTimeout } from './httpClient';

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
