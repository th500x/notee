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
  /** 本机工人：WS 刚收盘才推 */
  FRESH_CLOSE_MS: 5 * 60 * 1000,
  /** 海外 ingest 投递：允许收盘后最多 50 分钟内补推（Worker 漏跑时的余量） */
  INGEST_FRESH_CLOSE_MS: 50 * 60 * 1000,
  /**
   * REST 兜底 / 重启追赶：WS 半开漏收盘时仍可在此窗口内补推。
   * 须长于一小时周期，否则「漏一小时」永远推不到。
   */
  CATCHUP_FRESH_CLOSE_MS: 2 * 60 * 60 * 1000,
  /** 健康检查 / 假死判定的轮询间隔 */
  REST_POLL_MS: 20 * 1000,
  /**
   * WS 超过此时长无任何消息（含未收盘更新）即视为假死并强制重连。
   * 币安 1h kline 流在盘中会持续推未收盘更新，正常远短于此。
   */
  WS_STALE_MS: 90 * 1000,
  /** WS 看起来正常时，仍偶尔 REST 对一次账（安全带，不是主路径） */
  REST_HEALTHY_INTERVAL_MS: 5 * 60 * 1000,
  WS_RETRY_MIN_MS: 1000,
  WS_RETRY_MAX_MS: 30 * 1000,
  OPEN_URL: '/07-coin-index/',
  /** 操作记录「待记」列表：最近交叉条数（一年几百次，不自动开空表） */
  RECENT_SIGNAL_LIMIT: 24,
};

module.exports = { ETH_MA_CROSS };
