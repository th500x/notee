/**
 * 玩家会话事件总线
 *
 * 用途：让"无 React 上下文"的代码（如 `services/httpClient.js`）能广播会话失效事件，
 *      由 `hooks/useAuthFlow.js` 等 React 侧统一接收并处理（清 token + 跳登录页 + 预填账号）。
 *
 * 触发场景：
 *   1. 后端 `requireAuth` 返回 401 且 `code ∈ NO_TOKEN / BAD_TOKEN / TOKEN_EXPIRED`；
 *   2. 前端 `useAuthFlow` 启动检测到"`gameUser` 存在但 token 缺失 / 过期"。
 *
 * 设计约束：
 *   - **不**用 React Context / Redux，避免侵入太多组件树；
 *   - **不**用任何第三方 EventEmitter 库；直接复用 `window.CustomEvent`，零依赖；
 *   - 浏览器环境下生效；SSR 兼容性不在游戏前端考虑范围内。
 *
 * 与生产过渡（CR 必改 #1 后续）的关系：
 *   - 生产环境的"老 localStorage 没 token"必须靠这套通道引导用户重新登录（一次性）；
 *   - token 自然过期（默认 8h）也走同一路径，不引入"无密码续签"。
 *
 * @module utils/sessionEvents
 */

export const SESSION_EXPIRED_EVENT = 'sanstorm:session-expired';
export const ADMIN_SESSION_EXPIRED_EVENT = 'sanstorm:admin-session-expired';

/**
 * 触发"会话已失效"事件。
 * @param {{ reason?: 'NO_TOKEN' | 'BAD_TOKEN' | 'TOKEN_EXPIRED' | 'NO_TOKEN_LOCAL', accountId?: string }} [detail]
 */
export function emitSessionExpired(detail = {}) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail }));
  } catch {
    // 旧浏览器降级：忽略，宁可错过一次软重登也不抛异常打断业务
  }
}

/**
 * 订阅"会话已失效"事件。
 * @param {(detail: { reason?: string, accountId?: string }) => void} handler
 * @returns {() => void} 取消订阅
 */
export function onSessionExpired(handler) {
  if (typeof window === 'undefined') return () => {};
  const wrapper = (e) => {
    try { handler(e?.detail || {}); } catch (err) {
      console.error('[sessionEvents] handler error', err);
    }
  };
  window.addEventListener(SESSION_EXPIRED_EVENT, wrapper);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, wrapper);
}

export function emitAdminSessionExpired(detail = {}) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EXPIRED_EVENT, { detail }));
  } catch {
    /* ignore */
  }
}

export function onAdminSessionExpired(handler) {
  if (typeof window === 'undefined') return () => {};
  const wrapper = (e) => {
    try { handler(e?.detail || {}); } catch (err) {
      console.error('[sessionEvents] admin handler error', err);
    }
  };
  window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, wrapper);
  return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, wrapper);
}
