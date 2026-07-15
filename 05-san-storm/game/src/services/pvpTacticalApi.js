/**
 * PvP 战术对决房间 API 服务（与 backend/routes/pvp/tacticalRooms.js 契约对齐）
 *
 * 鉴权由 httpClient 自动附加 JWT；统一返回 `{ success, ... }` 或 `{ success:false, error }`。
 * 在线轮询 `getEvents(roomId, afterSeq)`（建议 300~500ms），离线/补看用 `getResult`。
 *
 * @see docs/00/00-base/02-architecture-split/13-pvp-tactical-api.md
 */

import { API_CONFIG } from '../constants';
import { fetchWithTimeout } from './httpClient';

const base = () => `${API_CONFIG.BASE_URL}/pvp/tactical-rooms`;
const jsonHeaders = { 'Content-Type': 'application/json' };

async function call(promise, label) {
  try {
    const response = await promise;
    const data = await response.json().catch(() => ({}));
    if (data && data.success) return data;
    return {
      success: false,
      error: data?.error || data?.message || `${label}失败`,
      code: data?.code,
      status: response.status,
    };
  } catch (error) {
    console.error(`[pvpTacticalAPI] ${label}请求失败`, error);
    return { success: false, error: '网络错误' };
  }
}

export const pvpTacticalAPI = {
  /** 我方待应战 / 进行中的房间列表 */
  listPending: () => call(fetchWithTimeout(`${base()}/pending`, { method: 'GET' }), '获取待应战列表'),

  /** 发起邀战 body: { opponentId, duelMapId? } */
  create: (body) =>
    call(
      fetchWithTimeout(base(), { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body || {}) }),
      '发起邀战',
    ),

  /** 应战（触发服务端推演） */
  accept: (roomId) => call(fetchWithTimeout(`${base()}/${roomId}/accept`, { method: 'POST' }), '应战'),

  /** 取消邀战 body: { reason? } */
  cancel: (roomId, reason) =>
    call(
      fetchWithTimeout(`${base()}/${roomId}/cancel`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ reason }),
      }),
      '取消邀战',
    ),

  /** 幂等触发 / 补触发推演（应战后兜底） */
  start: (roomId) => call(fetchWithTimeout(`${base()}/${roomId}/start`, { method: 'POST' }), '触发推演'),

  /** 房间元数据 + 观战视角（view.selfSide / selfLineup / opponentLineup） */
  getRoom: (roomId) => call(fetchWithTimeout(`${base()}/${roomId}`, { method: 'GET' }), '获取房间'),

  /** 增量拉取事件（afterSeq 之后）；返回 { events, eventSeq, status, winnerSide, viewerSide } */
  getEvents: (roomId, afterSeq = 0) =>
    call(
      fetchWithTimeout(`${base()}/${roomId}/events?afterSeq=${afterSeq || 0}`, { method: 'GET' }),
      '拉取事件',
    ),

  /** 结算结果（resolved 后） */
  getResult: (roomId) => call(fetchWithTimeout(`${base()}/${roomId}/result`, { method: 'GET' }), '获取结果'),
};

export default pvpTacticalAPI;
