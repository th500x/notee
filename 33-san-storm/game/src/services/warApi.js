/**
 * 战事 API 客户端（PVP 势力战事 / wars_pvp）
 *
 * 与 `garrisonApi` / `playerApi` 同仓库惯例：通过 `httpClient` 自动附 player token，
 * 路径前缀 `${API_CONFIG.BASE_URL}/pvp-wars`。
 *
 * 严禁组件内散装 `fetch('/api/pvp-wars/...')`；战事相关请求一律走本模块。
 *
 * @module services/warApi
 */

import { API_CONFIG } from '../constants';
import { fetchWithTimeout } from './httpClient';

const BASE = `${API_CONFIG.BASE_URL}/pvp-wars`;

async function fetchJSON(url, options = {}) {
  const res = await fetchWithTimeout(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  return res.json();
}

export const warAPI = {
  /**
   * 预览君主审批通过率区间：返回 `{ approved, baseChance, finalChance, rangeLow, rangeHigh, ... }`。
   * 用于宣战提案 UI：客户端展示 `[base, min(1, base*1.2)]`，提示「当次仍掷骰」。
   */
  async previewApproval({ factionId, proposalType = 'war', tributeSilver = 0 } = {}) {
    const params = new URLSearchParams({ factionId, proposalType });
    if (tributeSilver > 0) params.set('tributeSilver', String(tributeSilver));
    return fetchJSON(`${BASE}/preview-approval?${params.toString()}`);
  },

  /**
   * 三公府 · 势力战事「谏言」面板：与 AI 君主主动战事相同的郡邻接候选、战事并发上限（PVE∪PVP 合计 1）、战事类审批预览。
   * 须登录；`factionId` 须与当前角色势力一致。
   */
  async getRemonstrancePanel(factionId) {
    const qs = new URLSearchParams({ factionId }).toString();
    return fetchJSON(`${BASE}/remonstrance-panel?${qs}`);
  },

  /**
   * 发起宣战提案（君主被动审批）。通过则返回 draft 战事行（`pending` 状态，无大本营）。
   */
  async submitProposal({
    attackerFactionId,
    targetCityId,
    season,
    proposerPlayerId,
    proposalId,
    transientPolicies,
    tributeSilver = 0,
  }) {
    const body = {
      attackerFactionId,
      targetCityId,
      season,
      proposerPlayerId,
      proposalId,
      tributeSilver,
    };
    if (transientPolicies && typeof transientPolicies === 'object') {
      body.transientPolicies = transientPolicies;
    }
    return fetchJSON(`${BASE}/proposals`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** 单场战事阶段快照（11-3 · 临时政策阶段机） */
  async getWarPhase(pvpWarId) {
    return fetchJSON(`${BASE}/${encodeURIComponent(pvpWarId)}/phase`);
  },

  /** 列出战事（按状态/城/势力/赛季筛选） */
  async listWars({ status, cityId, factionId, season, limit } = {}) {
    const params = new URLSearchParams();
    if (status) params.set('status', Array.isArray(status) ? status.join(',') : status);
    if (cityId) params.set('cityId', cityId);
    if (factionId) params.set('factionId', factionId);
    if (season) params.set('season', String(season));
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    const j = await fetchJSON(`${BASE}${qs ? `?${qs}` : ''}`);
    if (j && typeof j === 'object' && !Array.isArray(j.wars) && Array.isArray(j.data)) {
      return { ...j, wars: j.data, count: j.data.length };
    }
    return j;
  },

  /** 取本城当前 active 战事；无则 `data: null`。 */
  async getActiveByCity(cityId) {
    return fetchJSON(`${BASE}/by-city/${encodeURIComponent(cityId)}/active`);
  },

  /** 战事详情（含 base_camp / side_stats JSON） */
  async getById(pvpWarId) {
    return fetchJSON(`${BASE}/${encodeURIComponent(pvpWarId)}`);
  },

  /**
   * 大本营落位 + 战事 active 化（pending → active）。
   * 服务端使用算法择槽，不接受客户端传入坐标（避免客户端绕过禁区）。
   */
  async placeBaseCamp(pvpWarId) {
    return fetchJSON(`${BASE}/${encodeURIComponent(pvpWarId)}/place-base-camp`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  /** 取消战事（pending / active → cancelled） */
  async cancelWar(pvpWarId, reason = '') {
    return fetchJSON(`${BASE}/${encodeURIComponent(pvpWarId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * 守方发起一场对攻方大本营的战斗：服务器返回大本营 NPC 守军切片（最多 4 支）。
   * `playerId` 用于战线锁，避免多人撞同一档大本营。
   */
  async initiateBaseCampSiege(pvpWarId, playerId) {
    return fetchJSON(`${BASE}/${encodeURIComponent(pvpWarId)}/base-camp-siege`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
  },

  /**
   * 守方写回大本营战果：`killedIndices` 为本场击杀的索引数组（从 `initiateBaseCampSiege` 返回的切片）。
   */
  async recordBaseCampSiegeResult(pvpWarId, {
    playerId,
    killedIndices = [],
    result = 'win',
    battleScore = 0,
    silverSpent = 0,
    battleReportSaved,
  } = {}) {
    return fetchJSON(`${BASE}/${encodeURIComponent(pvpWarId)}/base-camp-siege-result`, {
      method: 'POST',
      body: JSON.stringify({
        playerId,
        killedIndices,
        result,
        battleScore,
        silverSpent,
        ...(battleReportSaved !== undefined ? { battleReportSaved } : {}),
      }),
    });
  },

  /**
   * 攻方对目标城出击：服务端按防守者优先级（披挂 → 普通驻守 → NPC）择一返回。
   * 返回 `defenderType` 决定下一步：
   *   - `pvp_online`：实时 PVP（前端可继续走 PVP 挑战流程，亦可直接打异步切片）
   *   - `player_garrison`：异步 PVE 玩家驻守
   *   - `npc`：异步 PVE NPC 守军
   */
  async initiateAttackerCitySiege(pvpWarId, playerId) {
    return fetchJSON(`${BASE}/${encodeURIComponent(pvpWarId)}/city-siege`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
  },

  /**
   * 攻方对城：服务端权威演算并结算（冲锋动画入口）。
   */
  async resolveAttackerCitySiegeAuthoritative(pvpWarId, playerId, { continueChain = false } = {}) {
    return fetchJSON(
      `${BASE}/${encodeURIComponent(pvpWarId)}/city-siege-authoritative-resolve`,
      {
        method: 'POST',
        body: JSON.stringify({ playerId, continueChain: !!continueChain }),
      },
    );
  },

  /**
   * 守方打大本营：服务端权威演算并结算。
   */
  async resolveBaseCampSiegeAuthoritative(pvpWarId, playerId, { continueChain = false } = {}) {
    return fetchJSON(
      `${BASE}/${encodeURIComponent(pvpWarId)}/base-camp-siege-authoritative-resolve`,
      {
        method: 'POST',
        body: JSON.stringify({ playerId, continueChain: !!continueChain }),
      },
    );
  },

  /**
   * 攻方写回目标城战斗结果（三类防守者通用）。
   * 玩家防守者分支必须传 `defenderType / defenderPlayerId / defenderGarrisonSlot / garrisonUnits`，
   * NPC 分支须传 `npcBatchIndex`。
   */
  async recordAttackerCitySiegeResult(pvpWarId, payload = {}) {
    return fetchJSON(`${BASE}/${encodeURIComponent(pvpWarId)}/city-siege-result`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },
};

export default warAPI;
