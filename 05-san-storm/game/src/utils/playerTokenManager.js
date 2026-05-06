/**
 * 玩家会话 Token 管理（05-san-storm 后端 3005 签发）
 *
 * 与 `utils/tokenManager.js`（管理员 Token，3001 主站后端签发）相互独立：
 *   - 管理员 Token 写入 `STORAGE_KEYS.ADMIN_TOKEN`，30 天有效期；
 *   - 玩家 Token 写入 `STORAGE_KEYS.PLAYER_TOKEN`，由后端 `JWT_SECRET` + `PLAYER_TOKEN_TTL_SECONDS` 决定（默认 8h）；
 *
 * 由 `gameUserAPI.login` / `gameUserAPI.register` 在收到响应后调用 `save({ token, tokenExpiresAt })`
 * 存入；`apiFetch`（services/httpClient.js）会自动读取并附加 `Authorization: Bearer <token>` 头。
 *
 * @module utils/playerTokenManager
 */

import { STORAGE_KEYS } from '../constants';

/**
 * 持久化 `gameUser` 时不应写入 JWT，避免与独立 key 双轨不同步（刷新后误判「无 token」）。
 * @param {Record<string, unknown>} userLike
 */
export function stripPlayerTokenFields(userLike) {
  if (!userLike || typeof userLike !== 'object') return userLike;
  if (!('token' in userLike) && !('tokenExpiresAt' in userLike)) return userLike;
  const { token, tokenExpiresAt, ...rest } = userLike;
  return rest;
}

/**
 * 旧版曾把 token 嵌在 `gameUser` JSON 内；若独立 key 丢失，可从内嵌字段补写一次。
 * @param {Record<string, unknown>} userLike
 * @returns {boolean} 是否已成功写入且当前 `isValid()` 为真
 */
export function hydratePlayerTokenFromUserBlob(userLike) {
  if (!userLike || typeof userLike !== 'object') return false;
  const token = userLike.token;
  if (!token || typeof token !== 'string') return false;
  const rawExpiry = userLike.tokenExpiresAt;
  const tokenExpiresAt = Number(rawExpiry);
  if (Number.isFinite(tokenExpiresAt) && Date.now() > tokenExpiresAt) {
    return false;
  }
  playerTokenManager.save({
    token,
    tokenExpiresAt: Number.isFinite(tokenExpiresAt) ? tokenExpiresAt : undefined,
  });
  return playerTokenManager.isValid();
}

/**
 * 若 `gameUser` 含内嵌 token：尝试补写独立 key，并从 localStorage 的 `gameUser` 中移除 token 字段。
 * @returns {{ user: Record<string, unknown>, hydrated: boolean }}
 */
export function migrateEmbeddedPlayerTokenFromLocalState(user) {
  if (!user || typeof user !== 'object' || !user.token) {
    return { user, hydrated: false };
  }
  const hydrated = hydratePlayerTokenFromUserBlob(user);
  const stripped = stripPlayerTokenFields(user);
  try {
    localStorage.setItem('gameUser', JSON.stringify(stripped));
  } catch (err) {
    console.error('[PlayerTokenManager] 迁移内嵌 token 后写回 gameUser 失败:', err);
  }
  return { user: stripped, hydrated };
}

export const playerTokenManager = {
  /**
   * 保存玩家 token。
   * @param {{ token: string, tokenExpiresAt?: number }} payload
   *   tokenExpiresAt：UNIX 毫秒；缺省按 8h 推算。
   */
  save({ token, tokenExpiresAt }) {
    if (!token) return;
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYER_TOKEN, token);
      const expiry = Number.isFinite(tokenExpiresAt)
        ? tokenExpiresAt
        : Date.now() + 8 * 60 * 60 * 1000;
      localStorage.setItem(STORAGE_KEYS.PLAYER_TOKEN_EXPIRY, String(expiry));
    } catch (err) {
      console.error('[PlayerTokenManager] 保存 token 失败:', err);
    }
  },

  /**
   * 读取尚未过期的 token；过期返回 null 并自动清理。
   */
  get() {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.PLAYER_TOKEN);
      const expiry = localStorage.getItem(STORAGE_KEYS.PLAYER_TOKEN_EXPIRY);
      if (!token || !expiry) return null;
      if (Date.now() > parseInt(expiry, 10)) {
        playerTokenManager.clear();
        return null;
      }
      return token;
    } catch (err) {
      console.error('[PlayerTokenManager] 读取 token 失败:', err);
      return null;
    }
  },

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEYS.PLAYER_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.PLAYER_TOKEN_EXPIRY);
    } catch (err) {
      console.error('[PlayerTokenManager] 清除 token 失败:', err);
    }
  },

  isValid() {
    return playerTokenManager.get() !== null;
  },
};
