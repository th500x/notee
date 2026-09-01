/**
 * 海外投递用：从能访问交易所的网络拉 ETHUSDT 永续 15m。
 * 生产由 Cloudflare Worker 调用同等解析（cf-eth-ma-klines/src/index.js 须同步）。
 * 默认先 Gate（Cloudflare 上币安/Bitget 常 403）；失败再 Bybit → 币安。
 */

const { ETH_MA_CROSS } = require('../../constants/ethMaCross');
const { httpsGetJson, isClosedKline, fetchClosedKlines } = require('./binanceFuturesKline');

const INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_SOURCES = ['gate', 'bybit', 'binance'];

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function barFromOpen(openTime, close) {
  const open = toFiniteNumber(openTime);
  const price = toFiniteNumber(close);
  if (open == null || price == null) return null;
  return {
    openTime: open,
    closeTime: open + INTERVAL_MS - 1,
    close: price,
  };
}

function keepClosedSorted(rows, now = Date.now()) {
  return rows
    .filter((item) => item && isClosedKline(item, now))
    .sort((a, b) => a.openTime - b.openTime);
}

function parseGatePayload(json) {
  if (!Array.isArray(json)) {
    throw new Error('gate klines: unexpected payload');
  }
  return json.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const raw = toFiniteNumber(item.t);
    if (raw == null) return null;
    const openTime = raw < 1e12 ? raw * 1000 : raw;
    return barFromOpen(openTime, item.c);
  });
}

function parseBybitPayload(json) {
  if (!json || Number(json.retCode) !== 0 || !json.result || !Array.isArray(json.result.list)) {
    throw new Error('bybit klines: unexpected payload');
  }
  return json.result.list.map((row) => (Array.isArray(row) ? barFromOpen(row[0], row[4]) : null));
}

async function fetchBinanceClosedKlines() {
  const rows = await fetchClosedKlines();
  if (!rows.length) throw new Error('binance klines: no closed bars');
  return rows;
}

async function fetchGateClosedKlines() {
  const url =
    'https://api.gateio.ws/api/v4/futures/usdt/candlesticks' +
    `?contract=ETH_USDT&interval=15m&limit=${ETH_MA_CROSS.REST_LIMIT}`;
  const json = await httpsGetJson(url, { label: 'gate klines' });
  const rows = keepClosedSorted(parseGatePayload(json));
  if (!rows.length) throw new Error('gate klines: no closed bars');
  return rows;
}

async function fetchBybitClosedKlines() {
  const url =
    'https://api.bybit.com/v5/market/kline' +
    `?category=linear&symbol=${ETH_MA_CROSS.SYMBOL}&interval=15&limit=${ETH_MA_CROSS.REST_LIMIT}`;
  const json = await httpsGetJson(url, { label: 'bybit klines' });
  const rows = keepClosedSorted(parseBybitPayload(json));
  if (!rows.length) throw new Error('bybit klines: no closed bars');
  return rows;
}

const SOURCE_FETCHERS = {
  binance: fetchBinanceClosedKlines,
  gate: fetchGateClosedKlines,
  bybit: fetchBybitClosedKlines,
};

function parseSourceList() {
  const raw = String(process.env.ETH_MA_INGEST_KLINE_SOURCE || '').trim();
  const names = (raw ? raw.split(',') : DEFAULT_SOURCES)
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);
  const unknown = names.filter((name) => !SOURCE_FETCHERS[name]);
  if (unknown.length) {
    throw new Error(`unknown ingest kline source: ${unknown.join(', ')}`);
  }
  if (!names.length) {
    throw new Error('ingest kline source list is empty');
  }
  return names;
}

async function fetchClosedKlinesForIngest() {
  const names = parseSourceList();
  const errors = [];
  for (const name of names) {
    try {
      const klines = await SOURCE_FETCHERS[name]();
      console.log(`ingest klines source=${name} bars=${klines.length}`);
      return { source: name, klines };
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      errors.push(`${name}: ${message}`);
      console.error(`ingest klines ${name} failed: ${message}`);
    }
  }
  throw new Error(`all ingest kline sources failed: ${errors.join('; ')}`);
}

module.exports = {
  INTERVAL_MS,
  DEFAULT_SOURCES,
  barFromOpen,
  parseGatePayload,
  parseBybitPayload,
  keepClosedSorted,
  parseSourceList,
  fetchClosedKlinesForIngest,
};
