/**
 * 驻守API服务
 * 
 * @description 处理驻守编组相关的API请求
 */

import { API_CONFIG } from '../constants';

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

export const garrisonAPI = {
  /** 获取玩家所有驻守配置 */
  async getAll(playerId) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/garrisons/${playerId}`);
  },

  /** 获取某个槽位的驻守配置 */
  async getSlot(playerId, slot) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/garrisons/${playerId}/${slot}`);
  },

  /** 保存驻守配置 */
  async save(playerId, slot, config) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/garrisons/${playerId}/${slot}`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /** 清空驻守槽位 */
  async clear(playerId, slot) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/garrisons/${playerId}/${slot}`, {
      method: 'DELETE',
    });
  },

  /** 切换披挂上阵状态 */
  async setOnDuty(playerId, onDuty) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/garrisons/${playerId}/on-duty`, {
      method: 'POST',
      body: JSON.stringify({ onDuty }),
    });
  },

  /** 获取城市披挂上阵人数 */
  async getOnDutyCount(cityId) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/garrisons/city/${cityId}/on-duty-count`);
  },
};
