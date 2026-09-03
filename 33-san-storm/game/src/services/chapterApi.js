/**
 * 章节战棋 API
 */
import { API_CONFIG } from '../constants';
import { fetchWithTimeout } from './httpClient';

const BASE = `${API_CONFIG.BASE_URL}/chapter`;

export const chapterAPI = {
  async getCenter(playerId, season = 'san_1') {
    const q = new URLSearchParams({ playerId, season });
    const response = await fetchWithTimeout(`${BASE}/center?${q.toString()}`);
    return response.json();
  },

  async startNode(playerId, chapterId, nodeId) {
    const response = await fetchWithTimeout(`${BASE}/start-node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, chapterId, nodeId }),
    });
    return response.json();
  },

  async completeNode(playerId, chapterId, nodeId) {
    const response = await fetchWithTimeout(`${BASE}/complete-node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, chapterId, nodeId }),
    });
    return response.json();
  },

  async claimReward(playerId, chapterId) {
    const response = await fetchWithTimeout(`${BASE}/claim-reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, chapterId }),
    });
    return response.json();
  },
};
