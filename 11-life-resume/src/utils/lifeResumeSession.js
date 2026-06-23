/**
 * lifeResume local session (user blob + JWT from 05 login/register).
 */

import { STORAGE_KEYS, TOKEN_DURATION_MS } from '@/constants/storageKeys';

function stripTokenFields(userLike) {
  if (!userLike || typeof userLike !== 'object') return userLike;
  if (!('token' in userLike) && !('tokenExpiresAt' in userLike)) return userLike;
  const { token, tokenExpiresAt, password, ...rest } = userLike;
  return rest;
}

export const lifeResumeSession = {
  saveAuth(payload) {
    if (!payload?.token) return null;
    const user = stripTokenFields(payload);
    const expiry = Number.isFinite(Number(payload.tokenExpiresAt))
      ? Number(payload.tokenExpiresAt)
      : Date.now() + TOKEN_DURATION_MS;

    localStorage.setItem(STORAGE_KEYS.TOKEN, payload.token);
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(expiry));
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return user;
  },

  loadUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER);
      if (!raw) return null;
      const user = JSON.parse(raw);
      if (!lifeResumeSession.getToken()) return null;
      return user;
    } catch {
      return null;
    }
  },

  getToken() {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      const expiryRaw = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
      if (!token || !expiryRaw) return null;
      if (Date.now() > parseInt(expiryRaw, 10)) {
        lifeResumeSession.clear();
        return null;
      }
      return token;
    } catch {
      return null;
    }
  },

  clear() {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  isLoggedIn() {
    return lifeResumeSession.getToken() !== null;
  },
};
