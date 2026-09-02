/**
 * ETH 1h 均线订阅 — 与 11 backend/constants/ethMaCross.js 同名同值。
 */

export const ETH_MA_CROSS = {
  SYMBOL: 'ETHUSDT',
  KLINE_INTERVAL: '1h',
  SMA_FAST: 7,
  SMA_SLOW: 25,
  TOPIC: 'eth_ma_1h',
}

/** 与 11 `STORAGE_KEYS` 相同，生产同域可复用已登录会话（不是全站 SSO） */
export const LIFE_RESUME_STORAGE_KEYS = {
  USER: 'lifeResumeUser',
  TOKEN: 'lifeResumeToken',
  TOKEN_EXPIRY: 'lifeResumeTokenExpiry',
}

export const LIFE_RESUME_TOKEN_DURATION_MS = 30 * 24 * 60 * 60 * 1000
