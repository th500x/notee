/**
 * 探险系统 API（Extra 挂机派遣）
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

export const adventureAPI = {
  async getStatus(playerId) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/adventure/${playerId}`);
  },

  async dispatch(playerId, { extraSlot, themeId }) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/adventure/${playerId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({ extraSlot, themeId }),
    });
  },

  async claim(playerId, adventureId) {
    return fetchJSON(`${API_CONFIG.BASE_URL}/adventure/${playerId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ adventureId }),
    });
  },
};
