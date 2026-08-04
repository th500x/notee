/** CoinGecko 等外部 API 统一限速（与 collectWeeklyDataV2 一致） */
export const REQUEST_DELAY = 25000 // 25秒
export const RETRY_DELAY = 60000 // 重试 60秒（429 后等待更久）

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
