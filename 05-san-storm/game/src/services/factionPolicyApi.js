/**
 * 势力政策 API 客户端（11-3 实装段1）
 *
 * 与 `warApi.js` 同仓库惯例：经 `httpClient` 自动附 player token，
 * 路径前缀 `${API_CONFIG.BASE_URL}/faction-policies`。
 *
 * 严禁组件内散装 `fetch('/api/faction-policies/...')`；势力政策请求一律走本模块。
 *
 * @module services/factionPolicyApi
 */

import { API_CONFIG } from '../constants';
import { fetchWithTimeout } from './httpClient';

const BASE = `${API_CONFIG.BASE_URL}/faction-policies`;

async function fetchJSON(url, options = {}) {
  const res = await fetchWithTimeout(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  return res.json();
}

export const factionPolicyAPI = {
  /**
   * 朝政「势力政策」面板：四类当前生效配置 + CD + AI 君主审批预览 + 当前玩家谏言权位。
   * 须登录；`factionId` 须与当前角色一致。
   */
  async getPanel(factionId) {
    const qs = new URLSearchParams({ factionId }).toString();
    return fetchJSON(`${BASE}/panel?${qs}`);
  },

  /**
   * 长效政策谏言（11-3 §7.1 大司马 / 大司空）。
   * `config` schema 按类目：
   *   - ration_bonus:  { bonusPct: 5..50 }
   *   - siege_reward:  { personalSharePct: 0..100 }
   *   - recruit:       { enabled: boolean }
   *   - domestic_goal: { goal: 'population'|'commerce'|'agriculture'|'military'|'culture' }
   */
  async submitLongTermProposal({ factionId, category, config, proposalId } = {}) {
    return fetchJSON(`${BASE}/proposals/long-term`, {
      method: 'POST',
      body: JSON.stringify({
        factionId,
        category,
        config,
        ...(proposalId ? { proposalId } : {}),
      }),
    });
  },
};

export default factionPolicyAPI;
