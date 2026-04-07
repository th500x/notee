/**
 * 战役中心 API（config_campaigns + campaign_progress）
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
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接后重试');
    }
    throw error;
  }
}

const BASE = `${API_CONFIG.BASE_URL}/campaign`;

export const campaignAPI = {
  /** 已启用战役定义列表（下拉用） */
  async getDefinitions(season = 'san_1') {
    const response = await fetchWithTimeout(`${BASE}/definitions?season=${encodeURIComponent(season)}`);
    return response.json();
  },

  async getCenter(playerId, season = 'san_1') {
    const q = new URLSearchParams({ playerId, season });
    const response = await fetchWithTimeout(`${BASE}/center?${q.toString()}`);
    return response.json();
  },

  async claimReward(playerId, campaignId) {
    const response = await fetchWithTimeout(`${BASE}/claim-reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, campaignId }),
    });
    return response.json();
  },

  async patchProgress(playerId, patch) {
    const response = await fetchWithTimeout(`${BASE}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, patch }),
    });
    return response.json();
  },

  /** 战役地图 preset（与 shared/data/campaign/*.preset.json 一致） */
  async getPreset(campaignId) {
    const response = await fetchWithTimeout(
      `${BASE}/presets/${encodeURIComponent(campaignId)}`
    );
    return response.json();
  },
};
