/**
 * 聊天 API（天下 / 势力 / 军团）
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
    if (error.name === 'AbortError') throw new Error('请求超时');
    throw error;
  }
}

function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  return q.toString();
}

export const chatAPI = {
  /**
   * @param {string} playerId
   * @param {{ channelType: string, channelId?: string|null, limit?: number }} opts
   */
  async list(playerId, { channelType, channelId, limit = 100 }) {
    const params = { playerId, channelType, limit };
    if (channelType !== 'world' && channelId) params.channelId = channelId;
    const qs = buildQuery(params);
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/chats?${qs}`);
    const data = await response.json();
    if (data.success && data.data) {
      return {
        success: true,
        messages: data.data.messages || [],
        channelLabel: data.data.channelLabel,
      };
    }
    return { success: false, error: data.error || '加载失败', messages: [] };
  },

  /**
   * @param {string} playerId
   * @param {{ channelType: string, channelId?: string|null, content: string }} body
   */
  async send(playerId, { channelType, channelId, content }) {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId,
        channelType,
        channelId: channelId || null,
        content,
      }),
    });
    const data = await response.json();
    if (data.success && data.data) {
      return { success: true, message: data.data };
    }
    return { success: false, error: data.error || '发送失败', code: data.code };
  },

  async legionInfo(playerId) {
    const qs = buildQuery({ playerId });
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/chats/legion-info?${qs}`);
    const data = await response.json();
    if (data.success) {
      return { success: true, data: data.data || null };
    }
    return { success: false, data: null };
  },
};
