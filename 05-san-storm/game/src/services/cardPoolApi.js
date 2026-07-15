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
   * @param {'san_1'|'san_0'|null|undefined} [poolSeason] 将领池 Tab 对应赛季
   */
  draw: async (playerId, poolType, poolSeason, drawMode = 'single') => {
    try {
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/card-pool/draw`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId,
            poolType,
            drawMode,
            ...(poolSeason ? { poolSeason } : {}),
          }),
        }
      );
      return await response.json();
    } catch (error) {
      console.error('[CardPoolAPI] 抽取失败', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 卡池重复残影三选一
   */
  resolveEchoChoice: async (playerId, pendingEchoDrawId, choice) => {
    try {
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/card-pool/draw/echo-choice`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, pendingEchoDrawId, choice }),
        },
      );
      return await response.json();
    } catch (error) {
      console.error('[CardPoolAPI] 残影选择失败', error);
      return { success: false, error: error.message };
    }
  },
};
