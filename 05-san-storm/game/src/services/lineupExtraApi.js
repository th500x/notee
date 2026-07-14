/**
 * 上阵编组 Extra API
 * @description Extra A–D（lineup_slot 1–4）配置 CRUD
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

export const lineupExtraAPI = {
  /** 获取玩家全部 Extra 套（A–D） */
  async getAll(playerId) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/lineup-extra/${playerId}`);
  },

  /** 获取某一套 */
  async getSlot(playerId, slot) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/lineup-extra/${playerId}/${slot}`);
  },

  /** 保存某一套（服务端与库内行 merge） */
  async save(playerId, slot, config) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/lineup-extra/${playerId}/${slot}`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /** 清空某一套 */
  async clear(playerId, slot) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/lineup-extra/${playerId}/${slot}`, {
      method: 'DELETE',
    });
  },
};
