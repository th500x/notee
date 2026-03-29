/**
 * 玩家传书 API
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

export const textsAPI = {
  summary: async (playerId) => {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${encodeURIComponent(playerId)}/texts/summary`
    );
    const data = await response.json();
    if (data.success) return { success: true, unreadCount: data.unreadCount ?? 0 };
    return { success: false, error: data.error || '加载失败', unreadCount: 0 };
  },

  list: async (playerId) => {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${encodeURIComponent(playerId)}/texts`
    );
    const data = await response.json();
    if (data.success) return { success: true, texts: data.texts || [] };
    return { success: false, error: data.error || '加载失败', texts: [] };
  },

  markRead: async (playerId, textId) => {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${encodeURIComponent(playerId)}/texts/${encodeURIComponent(textId)}/read`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    );
    const data = await response.json();
    return { success: !!data.success, error: data.error };
  },

  claim: async (playerId, textId) => {
    const response = await fetchWithTimeout(
      `${API_CONFIG.BASE_URL}/players/${encodeURIComponent(playerId)}/texts/${encodeURIComponent(textId)}/claim`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    );
    const rawText = await response.text();
    let data;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      return { success: false, error: '服务器返回非 JSON，请确认 API 地址与后端版本' };
    }
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || `领取失败 (${response.status})` };
    }
    let payload = data.data;
    if (payload != null && typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }
    if (payload == null || typeof payload !== 'object') payload = {};
    const details = Array.isArray(payload.details)
      ? payload.details
      : Array.isArray(data.details)
        ? data.details
        : [];
    return { success: true, data: { ...payload, details }, details };
  }
};
