/**
 * 11 JWT 会话（localStorage）。字段与 11 `lifeResumeSession` 对齐。
 */

import { LIFE_RESUME_STORAGE_KEYS, LIFE_RESUME_TOKEN_DURATION_MS } from '../constants/ethMaCross'

export function normalizeAccountId(id) {
  return String(id || '').trim().toUpperCase()
}

/** 与 05/11 相同：首位 0–9，后三位 A–Z / 0–9 */
export function validateAccountIdFormat(id) {
  return /^[0-9][A-Z0-9]{3}$/.test(normalizeAccountId(id))
}

function stripTokenFields(userLike) {
  if (!userLike || typeof userLike !== 'object') return userLike
  if (!('token' in userLike) && !('tokenExpiresAt' in userLike)) return userLike
  const { token, tokenExpiresAt, password, ...rest } = userLike
  return rest
}

export const lifeResumeSession = {
  saveAuth(payload) {
    if (!payload?.token) return null
    const user = stripTokenFields(payload)
    const expiry = Number.isFinite(Number(payload.tokenExpiresAt))
      ? Number(payload.tokenExpiresAt)
      : Date.now() + LIFE_RESUME_TOKEN_DURATION_MS

    localStorage.setItem(LIFE_RESUME_STORAGE_KEYS.TOKEN, payload.token)
    localStorage.setItem(LIFE_RESUME_STORAGE_KEYS.TOKEN_EXPIRY, String(expiry))
    localStorage.setItem(LIFE_RESUME_STORAGE_KEYS.USER, JSON.stringify(user))
    return user
  },

  loadUser() {
    try {
      const raw = localStorage.getItem(LIFE_RESUME_STORAGE_KEYS.USER)
      if (!raw) return null
      if (!lifeResumeSession.getToken()) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  },

  getToken() {
    try {
      const token = localStorage.getItem(LIFE_RESUME_STORAGE_KEYS.TOKEN)
      const expiryRaw = localStorage.getItem(LIFE_RESUME_STORAGE_KEYS.TOKEN_EXPIRY)
      if (!token || !expiryRaw) return null
      if (Date.now() > parseInt(expiryRaw, 10)) {
        lifeResumeSession.clear()
        return null
      }
      return token
    } catch {
      return null
    }
  },

  clear() {
    localStorage.removeItem(LIFE_RESUME_STORAGE_KEYS.TOKEN)
    localStorage.removeItem(LIFE_RESUME_STORAGE_KEYS.TOKEN_EXPIRY)
    localStorage.removeItem(LIFE_RESUME_STORAGE_KEYS.USER)
  },
}
