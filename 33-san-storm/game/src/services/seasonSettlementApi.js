/**
 * 赛季继承（结算）API 包装（Phase 2 · 见 19-3 §7.1 / §9）
 *
 * 对接后端：
 *   GET  /api/players/:playerId/season-settlement/preview
 *   GET  /api/players/:playerId/season-settlement/status
 *   POST /api/players/:playerId/season-settlement/confirm
 *   POST /api/players/:playerId/season-settlement/apply
 *
 * 统一返回后端 JSON（{ success, data?, error?, code? }）；网络/非 JSON 失败时归一为
 * `{ success: false, error }`，不抛裸异常给 UI。
 *
 * @module services/seasonSettlementApi
 */

import { API_CONFIG } from '../constants';
import { fetchWithTimeout } from './httpClient';

async function readJson(response, label) {
  const ct = (response.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    try {
      const j = await response.json();
      if (j && typeof j === 'object') return j;
    } catch (_) {
      /* fall through */
    }
  }
  return { success: false, error: `${label} 失败（HTTP ${response.status}）` };
}

function base(playerId) {
  return `${API_CONFIG.BASE_URL}/players/${encodeURIComponent(playerId)}/season-settlement`;
}

export const seasonSettlementAPI = {
  /** 预览：自动继承 + 可选清单 + 上限 + 是否已封档 */
  async getPreview(playerId) {
    try {
      const res = await fetchWithTimeout(`${base(playerId)}/preview`, { method: 'GET' });
      return await readJson(res, '获取赛季继承预览');
    } catch (error) {
      return { success: false, error: error?.message || '获取赛季继承预览失败' };
    }
  },

  /** 状态：封档 / 待发放 / 已发放，及窗口是否开启 */
  async getStatus(playerId) {
    try {
      const res = await fetchWithTimeout(`${base(playerId)}/status`, { method: 'GET' });
      return await readJson(res, '获取赛季继承状态');
    } catch (error) {
      return { success: false, error: error?.message || '获取赛季继承状态失败' };
    }
  },

  /**
   * 确认封档。
   * @param {string} playerId
   * @param {{ equipmentSetInstanceIds?: string[], legendaryTroopInstanceIds?: string[] }} selection
   */
  async confirm(playerId, selection) {
    try {
      const res = await fetchWithTimeout(`${base(playerId)}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentSetInstanceIds: selection?.equipmentSetInstanceIds || [],
          legendaryTroopInstanceIds: selection?.legendaryTroopInstanceIds || [],
        }),
      });
      return await readJson(res, '赛季继承封档');
    } catch (error) {
      return { success: false, error: error?.message || '赛季继承封档失败' };
    }
  },

  /** 发放：新赛季创角后领取继承物品（幂等） */
  async apply(playerId) {
    try {
      const res = await fetchWithTimeout(`${base(playerId)}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      return await readJson(res, '赛季结算发放');
    } catch (error) {
      return { success: false, error: error?.message || '赛季结算发放失败' };
    }
  },
};

export default seasonSettlementAPI;
