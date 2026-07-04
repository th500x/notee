/** CoinGecko 等外部 API 统一限速（与 collectWeeklyDataV2 一致） */
export const REQUEST_DELAY = 25000 // 25秒
export const RETRY_DELAY = 30000 // 重试 30秒

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
