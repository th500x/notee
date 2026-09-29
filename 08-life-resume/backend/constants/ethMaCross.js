/**
 * ETH 1h SMA 金叉/死叉 — 与 07 前端常量同名同值。
 * 周期钉死 1h；品种钉死 U 本位永续 ETHUSDT。
 */

const ETH_MA_CROSS = {
  SYMBOL: 'ETHUSDT',
  MARKET: 'usdm_perp',
  KLINE_INTERVAL: '1h',
  SMA_FAST: 7,
  SMA_SLOW: 25,
  TOPIC: 'eth_ma_1h',
  STATE_ROW_ID: 1,
  REST_KLINES_URL: 'https://fapi.binance.com/fapi/v1/klines',
  WS_KLINE_URL: 'wss://fstream.binance.com/ws/ethusdt@kline_1h',
  REST_LIMIT: 50,
  REST_TIMEOUT_MS: 15000,
  USER_AGENT: 'Mozilla/5.0 (compatible; notee-eth-ma-cross/1.0)',
  /** 本机工人：刚收盘才推 */
  FRESH_CLOSE_MS: 3 * 60 * 1000,
  /** 海外 ingest 投递：允许收盘后最多 50 分钟内补推（Worker 漏跑时的余量） */
  INGEST_FRESH_CLOSE_MS: 50 * 60 * 1000,
  REST_POLL_MS: 20 * 1000,
  WS_RETRY_MIN_MS: 1000,
  WS_RETRY_MAX_MS: 30 * 1000,
  OPEN_URL: '/07-coin-index/',
  /** 操作记录「待记」列表：最近交叉条数（一年几百次，不自动开空表） */
  RECENT_SIGNAL_LIMIT: 24,
};

module.exports = { ETH_MA_CROSS };
