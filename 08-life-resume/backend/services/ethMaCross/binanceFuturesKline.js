/**
 * 币安 U 本位永续 K 线：REST 灌入 + WS 收盘事件。
 * REST 用 HTTPS/1.1 + IPv4（不用 Node fetch：国内机常见 fetch failed / HTTP2 被拦）。
 */

const https = require('https');
const { URL } = require('url');
const { ETH_MA_CROSS } = require('../../constants/ethMaCross');

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatNetError(err) {
  if (!err) return 'unknown error';
  const bits = [err.message];
  if (err.code && String(err.code) !== String(err.message)) bits.push(String(err.code));
  if (err.cause) {
    const cause = err.cause;
    if (cause.code) bits.push(String(cause.code));
    if (cause.message) bits.push(String(cause.message));
  }
  return bits.filter(Boolean).join(' | ');
}

function getProxyUrl() {
  return String(
    process.env.BINANCE_HTTPS_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || ''
  ).trim();
}

function getHttpsProxyAgent() {
  const proxy = getProxyUrl();
  if (!proxy) return undefined;
  let loaded;
  try {
    loaded = require('https-proxy-agent');
  } catch (err) {
    throw new Error(`BINANCE_HTTPS_PROXY 已设置但未安装 https-proxy-agent: ${err.message}`);
  }
  const HttpsProxyAgent = loaded.HttpsProxyAgent || loaded;
  return new HttpsProxyAgent(proxy);
}

function resolveRestKlinesUrl(symbol, interval, limit) {
  const override = String(process.env.BINANCE_KLINES_URL || '').trim();
  const url = new URL(override || ETH_MA_CROSS.REST_KLINES_URL);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('limit', String(limit));
  return url.toString();
}

function resolveWsKlineUrl() {
  return String(process.env.BINANCE_WS_KLINE_URL || '').trim() || ETH_MA_CROSS.WS_KLINE_URL;
}

function getWsConnectOptions() {
  const agent = getHttpsProxyAgent();
  return {
    family: 4,
    handshakeTimeout: ETH_MA_CROSS.REST_TIMEOUT_MS,
    headers: { 'User-Agent': ETH_MA_CROSS.USER_AGENT },
    ...(agent ? { agent } : {}),
  };
}

function httpsGetJson(urlString, options = {}) {
  const label = options.label || 'Binance klines';
  const agent = getHttpsProxyAgent();
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        family: 4,
        timeout: ETH_MA_CROSS.REST_TIMEOUT_MS,
        agent,
        headers: {
          Accept: 'application/json',
          'User-Agent': ETH_MA_CROSS.USER_AGENT,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`${label} HTTP ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error(`${label}: unexpected payload`));
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`${label} timeout`));
    });
    req.on('error', reject);
    req.end();
  });
}

function normalizeClosedKline(partial) {
  const openTime = toFiniteNumber(partial.openTime);
  const closeTime = toFiniteNumber(partial.closeTime);
  const close = toFiniteNumber(partial.close);
  if (openTime == null || closeTime == null || close == null) return null;
  return { openTime, closeTime, close };
}

function parseRestKline(row) {
  if (!Array.isArray(row) || row.length < 7) return null;
  return normalizeClosedKline({
    openTime: row[0],
    closeTime: row[6],
    close: row[4],
  });
}

function parseWsKlinePayload(raw) {
  let message = raw;
  if (typeof raw === 'string') {
    try {
      message = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const k = message && message.k;
  if (!k || k.x !== true) return null;
  if (k.s && String(k.s).toUpperCase() !== ETH_MA_CROSS.SYMBOL) return null;
  if (k.i && String(k.i) !== ETH_MA_CROSS.KLINE_INTERVAL) return null;
  return normalizeClosedKline({
    openTime: k.t,
    closeTime: k.T,
    close: k.c,
  });
}

function isClosedKline(kline, now = Date.now()) {
  return Boolean(kline && Number(kline.closeTime) < now);
}

function upsertClosedKline(klines, next) {
  if (!next) return klines;
  const list = Array.isArray(klines) ? klines.slice() : [];
  const index = list.findIndex((item) => item.openTime === next.openTime);
  if (index >= 0) {
    list[index] = next;
  } else {
    list.push(next);
    list.sort((a, b) => a.openTime - b.openTime);
  }
  const overflow = list.length - 80;
  if (overflow > 0) list.splice(0, overflow);
  return list;
}

async function fetchClosedKlines(options = {}) {
  const symbol = options.symbol || ETH_MA_CROSS.SYMBOL;
  const interval = options.interval || ETH_MA_CROSS.KLINE_INTERVAL;
  const limit = options.limit || ETH_MA_CROSS.REST_LIMIT;
  const url = resolveRestKlinesUrl(symbol, interval, limit);
  const rows = await httpsGetJson(url);
  if (!Array.isArray(rows)) {
    throw new Error('Binance klines: unexpected payload');
  }
  const now = Date.now();
  return rows
    .map(parseRestKline)
    .filter((kline) => isClosedKline(kline, now));
}

module.exports = {
  parseRestKline,
  parseWsKlinePayload,
  isClosedKline,
  upsertClosedKline,
  fetchClosedKlines,
  formatNetError,
  resolveRestKlinesUrl,
  resolveWsKlineUrl,
  getWsConnectOptions,
  getProxyUrl,
  httpsGetJson,
};
