/**
 * 统一 HTTP 客户端（05-san-storm 后端 3005）
 *
 * 职责：
 *   1. 封装 `fetch` 超时（与 API_CONFIG.TIMEOUT 一致）。
 *   2. **自动附加 `Authorization: Bearer` 头**：
 *      - 管理 API（`/admin/*`、部分 `/auth/*`、调试 tick）：优先 `tokenManager`（主站 3001 global JWT）；
 *      - 其余 san-storm 请求：`playerTokenManager` 玩家 JWT。
 *   3. **响应侧统一处理鉴权失效**：识别 `401 + code ∈ NO_TOKEN / BAD_TOKEN / TOKEN_EXPIRED`，
 *      派发 `sanstorm:session-expired` 事件，由 `useAuthFlow` 引导用户走"软重登"。
 *      普通业务 401 / 密码错误的 401（无 code 字段）不会触发此通道。
 *
 * 调用方仍接到原始 `Response` 对象，与原 `fetchWithTimeout` 完全兼容；旧代码替换 import
 * 即可使用，无需改动 `.json()` / `.ok` 等用法。
 *
 * @module services/httpClient
 */

import { playerTokenManager } from '../utils/playerTokenManager';
import { tokenManager } from '../utils/tokenManager';
import { API_CONFIG } from '../constants';
import { emitSessionExpired } from '../utils/sessionEvents';

/**
 * 仅当请求指向 san-storm 后端（3005，对应 `API_CONFIG.BASE_URL`）时附加玩家 token。
 *   - 相对路径（以 `/` 开头）：默认视为 san-storm（vite 代理 / nginx 同站）。
 *   - 绝对路径：以 `API_CONFIG.BASE_URL` 起始才附加，避免误把玩家 token 发到主站后端 3001（`AUTH_BASE_URL`）。
 */
function shouldAttachPlayerToken(url) {
  if (!url) return false;
  if (url.startsWith('/')) return true;
  return url.startsWith(API_CONFIG.BASE_URL);
}

function extractPathname(url) {
  if (!url) return '';
  if (url.startsWith('/')) return url.split('?')[0];
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0];
  }
}

/** 管理端 API：须主站 global JWT（`notee-admin-token`）或本地 ADMIN_DEV_BYPASS。 */
function isAdminApiPath(pathname) {
  if (pathname.includes('/admin/')) return true;
  if (/\/auth\/(users|ban|unban|switch-server)(\/|$)/.test(pathname)) return true;
  if (/\/auth\/user\//.test(pathname)) return true;
  if (/\/pvp-wars\/(tick|active-decision-dry-run)(\/|$)/.test(pathname)) return true;
  return false;
}

function shouldAttachAdminToken(url) {
  if (!shouldAttachPlayerToken(url)) return false;
  return isAdminApiPath(extractPathname(url));
}

/**
 * 与原 `fetchWithTimeout` 同签名（同名导出方便机械替换）。
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [timeout]
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeout = API_CONFIG.TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const headers = new Headers(options.headers || {});
  if (shouldAttachAdminToken(url)) {
    const adminToken = tokenManager.get();
    if (adminToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${adminToken}`);
    }
  } else if (shouldAttachPlayerToken(url)) {
    const token = playerTokenManager.get();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.status === 401 && shouldAttachPlayerToken(url) && !shouldAttachAdminToken(url)) {
      await maybeEmitSessionExpired(response);
    }
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接后重试');
    }
    throw error;
  }
}

/**
 * 仅 san-storm 后端 401，且响应体 `code` 命中鉴权失效白名单时才派发事件。
 *
 * 设计：克隆 response 读 body，避免破坏调用方后续 `.json()` / `.text()`；解析失败默认不派发，
 *      防止把"非 JSON 响应 / 网关 401"误识别为会话失效。
 */
async function maybeEmitSessionExpired(response) {
  try {
    const cloned = response.clone();
    const body = await cloned.json();
    const code = body && body.code;
    if (code === 'NO_TOKEN' || code === 'BAD_TOKEN' || code === 'TOKEN_EXPIRED') {
      playerTokenManager.clear();
      emitSessionExpired({ reason: code });
    }
  } catch {
    // 非 JSON / 解析失败 / response 已被消费：不派发，保持现有行为
  }
}

/** 命名别名：意图更清晰的入口（新代码优先使用） */
export const apiFetch = fetchWithTimeout;

/**
 * GET + JSON 解析（用于加载公开静态 JSON 文件，如 `public/data/shared/*.json`）。
 *
 * 与 `fetchWithTimeout` 共享同一超时 / token 附加逻辑（公开 JSON 通常是相对路径或同源
 * static，自动 token 附加是 no-op）；仅多了"检查 `response.ok` + `.json()` + 错误日志"
 * 的薄壳，避免 `dataService` 等公共数据加载层重复写。
 *
 * 历史：原本住在 `services/api.js` 命名 `get`；CR C4 将 `api.js` 拆成多个业务域 API 后，
 * 此通用工具上迁到 `httpClient.js`。
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>} 解析后的 JSON 值
 */
export async function getJson(url, options = {}) {
  try {
    const response = await fetchWithTimeout(url, {
      ...options,
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[httpClient.getJson] GET 请求失败:', url, error);
    throw error;
  }
}
