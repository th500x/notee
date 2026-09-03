/**
 * 管理员 · 传书模板 config_texts API（san-storm 后端 3005）
 *
 * 走 `/admin/config-texts/*`；入口鉴权见前端 `AdminPageGate` / `useAdmin`（主站 JWT）。
 *
 * @module services/adminConfigTextsApi
 */

import { API_CONFIG } from '../constants';
import { fetchWithTimeout } from './httpClient';

export const adminConfigTextsAPI = {
  list: async (params = {}) => {
    const q = new URLSearchParams();
    if (params.enabledOnly) q.set('enabledOnly', '1');
    const url = `${API_CONFIG.BASE_URL}/admin/config-texts${q.toString() ? `?${q}` : ''}`;
    const response = await fetchWithTimeout(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    const data = await response.json();
    if (data.success) return { success: true, data: data.data, total: data.total };
    return { success: false, error: data.error || '加载模板失败' };
  },

  get: async (templateId) => {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/admin/config-texts/${encodeURIComponent(templateId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) return { success: true, data: data.data };
    return { success: false, error: data.error || '获取模板失败' };
  },

  create: async (body) => {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/admin/config-texts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (response.ok && data.success) return { success: true, data: data.data };
    return { success: false, error: data.error || '创建失败' };
  },

  update: async (templateId, body) => {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/admin/config-texts/${encodeURIComponent(templateId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (data.success) return { success: true, data: data.data };
    return { success: false, error: data.error || '更新失败' };
  },

  remove: async (templateId) => {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/admin/config-texts/${encodeURIComponent(templateId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) return { success: true };
    return { success: false, error: data.error || '删除失败' };
  },

  trialSend: async (payload) => {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/admin/config-texts/trial-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.success) return { success: true, data: data.data };
    return { success: false, error: data.error || '试发失败' };
  }
};

export default adminConfigTextsAPI;
