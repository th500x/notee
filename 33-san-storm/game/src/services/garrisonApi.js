/**
 * 驻守API服务
 * 
 * @description 处理驻守编组相关的API请求
 */

import { API_CONFIG } from '../constants';
import { fetchWithTimeout } from './httpClient';

async function fetchJSON(url, options = {}) {
  const res = await fetchWithTimeout(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  return res.json();
}

export const garrisonAPI = {
  /** 获取玩家所有驻守配置 */
  async getAll(playerId) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/garrisons/${playerId}`);
  },

  /** 获取玩家在某城的驻地槽位列表（卡池 A/B） */
  async getByCity(playerId, cityId) {
    const enc = encodeURIComponent(cityId);
    return fetchJSON(`${API_CONFIG.BASE_URL}/garrisons/${playerId}/by-city/${enc}`);
  },

  /** 获取某个槽位的驻守配置（须传 cityId） */
  async getSlot(playerId, slot, cityId) {
    const enc = encodeURIComponent(cityId);
    return fetchJSON(`${API_CONFIG.BASE_URL}/garrisons/${playerId}/${slot}?cityId=${enc}`);
  },

  /** 保存驻守配置 */
  async save(playerId, slot, config) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/garrisons/${playerId}/${slot}`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /** 清空驻守槽位（须传 cityId） */
  async clear(playerId, slot, cityId) {
    const enc = encodeURIComponent(cityId);
    return fetchJSON(`${API_CONFIG.BASE_URL}/garrisons/${playerId}/${slot}?cityId=${enc}`, {
      method: 'DELETE',
    });
  },

  /** 披挂上阵已移除（保留方法签名以免旧调用崩溃；恒失败） */
  async setOnDuty() {
    return { success: false, error: '披挂上阵已移除', code: 'ON_DUTY_REMOVED', onDuty: false };
  },

  /** 披挂上阵已移除 */
  async getOnDutyCount() {
    return { success: false, error: '披挂上阵已移除', code: 'ON_DUTY_REMOVED', count: 0 };
  },
};
