/**
 * 排行榜 API（san-storm 后端 3005，公开数据）
 *
 * 三类查询：
 *   1. 活动排行榜（公告 ranking · temp_event_ranking，见 32-3 §4）
 *   2. 常驻 · 总体排名（27-2）
 *   3. 常驻 · 战役最高分（27-2）
 *
 * @module services/rankingsApi
 */

import { API_CONFIG } from '../constants';
import { fetchWithTimeout } from './httpClient';

export const rankingsAPI = {
  /**
   * 获取活动排行榜
   * @param {string} eventId - 活动ID（公告ID）
   * @param {object} options - { limit, playerId }
   */
  getRankings: async (eventId, { limit = 10, playerId = null } = {}) => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (playerId) params.set('playerId', playerId);

      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/rankings/${eventId}?${params}`,
        { method: 'GET' }
      );

      const data = await response.json();

      if (data.success) {
        return { success: true, data: data.data };
      } else {
        return { success: false, error: data.error || '获取排行榜失败' };
      }
    } catch (error) {
      console.error('[RankingsAPI] 获取排行榜失败', error);
      return { success: false, error: '网络错误' };
    }
  },

  /**
   * 常驻 · 总体排名（27-2）
   * @param {{ limit?: number, playerId?: string, serverId?: string }} options
   */
  getOverall: async ({ limit = 30, playerId = null, serverId = null, sort = null } = {}) => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (playerId) params.set('playerId', playerId);
      if (serverId) params.set('serverId', serverId);
      if (sort) params.set('sort', String(sort));
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/rankings/overall?${params}`,
        { method: 'GET' }
      );
      const data = await response.json();
      if (data.success) return { success: true, data: data.data };
      return { success: false, error: data.error || '获取总体排行失败' };
    } catch (error) {
      console.error('[RankingsAPI] overall', error);
      return { success: false, error: '网络错误' };
    }
  },

  /**
   * 常驻 · 战役最高分（27-2）
   * @param {{ campaignId: string, limit?: number, playerId?: string, serverId?: string }} options
   */
  getCampaign: async ({ campaignId, limit = 30, playerId = null, serverId = null }) => {
    try {
      const params = new URLSearchParams({
        campaignId: String(campaignId),
        limit: String(limit),
      });
      if (playerId) params.set('playerId', playerId);
      if (serverId) params.set('serverId', serverId);
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/rankings/campaign?${params}`,
        { method: 'GET' }
      );
      const data = await response.json();
      if (data.success) return { success: true, data: data.data };
      return { success: false, error: data.error || '获取战役排行失败' };
    } catch (error) {
      console.error('[RankingsAPI] campaign', error);
      return { success: false, error: '网络错误' };
    }
  },
};

export default rankingsAPI;
