/**
 * Cloudflare Worker：海外拉 ETHUSDT 永续 1h 已收盘 K 线，POST 到 11 ingest。
 * 默认 Gate → Bybit → 币安。交叉时在海外代发 Web Push。
 * 解析须与 ingestPublicKlines.js 同步。
 */

import {
  ackUrlFromIngest,
  sendRelayedPushes,
  summarizeIngestBody,
  summarizePushResult,
} from './webPushRelay.js';

const ACK_ATTEMPTS = 3;
const ACK_RETRY_MS = 400;

const SYMBOL = 'ETHUSDT';
const REST_LIMIT = 50;
const INTERVAL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15000;
const DEFAULT_SOURCES = ['gate', 'bybit', 'binance'];
const USER_AGENT = 'Mozilla/5.0 (compatible; notee-eth-ma-cross/1.0)';

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

function isClosedKline(kline, now = Date.now()) {
  return Boolean(kline && Number(kline.closeTime) < now);
}

function keepClosedSorted(rows, now = Date.now()) {
  return rows
    .filter((item) => item && isClosedKline(item, now))
    .sort((a, b) => a.openTime - b.openTime);
}

function parseBinancePayload(json) {
  if (!Array.isArray(json)) {
    throw new Error('binance klines: unexpected payload');
  }
  return json.map((row) => {
    if (!Array.isArray(row) || row.length < 7) return null;
    const openTime = toFiniteNumber(row[0]);
    const closeTime = toFiniteNumber(row[6]);
    const close = toFiniteNumber(row[4]);
    if (openTime == null || closeTime == null || close == null) return null;
    return { openTime, closeTime, close };
  });
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

function secretsEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function fetchJson(url, label) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`${label} HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchBinanceClosedKlines() {
  const url =
    `https://fapi.binance.com/fapi/v1/klines` +
    `?symbol=${SYMBOL}&interval=1h&limit=${REST_LIMIT}`;
  const rows = keepClosedSorted(parseBinancePayload(await fetchJson(url, 'binance klines')));
  if (!rows.length) throw new Error('binance klines: no closed bars');
  return rows;
}

async function fetchGateClosedKlines() {
  const url =
    `https://api.gateio.ws/api/v4/futures/usdt/candlesticks` +
    `?contract=ETH_USDT&interval=1h&limit=${REST_LIMIT}`;
  const rows = keepClosedSorted(parseGatePayload(await fetchJson(url, 'gate klines')));
  if (!rows.length) throw new Error('gate klines: no closed bars');
  return rows;
}

async function fetchBybitClosedKlines() {
  const url =
    `https://api.bybit.com/v5/market/kline` +
    `?category=linear&symbol=${SYMBOL}&interval=60&limit=${REST_LIMIT}`;
  const rows = keepClosedSorted(parseBybitPayload(await fetchJson(url, 'bybit klines')));
  if (!rows.length) throw new Error('bybit klines: no closed bars');
  return rows;
}

const SOURCE_FETCHERS = {
  binance: fetchBinanceClosedKlines,
  gate: fetchGateClosedKlines,
  bybit: fetchBybitClosedKlines,
};

function parseSourceList(raw) {
  const names = (String(raw || '').trim() ? String(raw).split(',') : DEFAULT_SOURCES)
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

async function fetchClosedKlinesForIngest(sourceRaw) {
  const names = parseSourceList(sourceRaw);
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

async function runIngest(env) {
  const url = String(env.ETH_MA_INGEST_URL || '').trim();
  const secret = String(env.ETH_MA_INGEST_SECRET || '').trim();
  if (!url || secret.length < 16) {
    throw new Error('missing ETH_MA_INGEST_URL or ETH_MA_INGEST_SECRET');
  }

  const { source, klines } = await fetchClosedKlinesForIngest(env.ETH_MA_INGEST_KLINE_SOURCE);
  if (!klines.length) {
    throw new Error('no closed klines from ingest sources');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Eth-Ma-Ingest-Secret': secret,
    },
    body: JSON.stringify({ source, klines }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const text = await res.text();
  const summary = summarizeIngestBody(text);
  console.log(res.status, JSON.stringify(summary));
  if (!res.ok) {
    throw new Error(`ingest HTTP ${res.status}`);
  }

  let ingestJson = null;
  try {
    ingestJson = JSON.parse(text);
  } catch {
    throw new Error('ingest response is not JSON');
  }
  const dispatch = ingestJson && ingestJson.data ? ingestJson.data.pushDispatch : null;
  let push = null;
  if (dispatch && Array.isArray(dispatch.subscriptions) && dispatch.subscriptions.length) {
    push = await sendRelayedPushes(dispatch);
    console.log(`web-push relay sent=${push.sent} failed=${push.failed} gone=${push.gone}`);
    await postPushAck(ackUrlFromIngest(url), secret, {
      closedOpenTime: ingestJson.data.closedOpenTime,
      sent: push.sent,
      failed: push.failed,
      gone: push.gone,
      goneEndpoints: push.goneEndpoints,
    });
  }

  return {
    source,
    barCount: klines.length,
    ingestStatus: res.status,
    ingest: summary,
    push: summarizePushResult(push),
  };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function postPushAck(ackUrl, secret, body) {
  let lastMessage = 'push-ack failed';
  for (let attempt = 1; attempt <= ACK_ATTEMPTS; attempt += 1) {
    try {
      const ackRes = await fetch(ackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Eth-Ma-Ingest-Secret': secret,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (ackRes.ok) {
        console.log(`push-ack HTTP ${ackRes.status}`);
        return;
      }
      lastMessage = `push-ack HTTP ${ackRes.status}`;
      console.error(`${lastMessage} attempt=${attempt}`);
    } catch (err) {
      lastMessage = err && err.message ? err.message : String(err);
      console.error(`push-ack error attempt=${attempt}: ${lastMessage}`);
    }
    if (attempt < ACK_ATTEMPTS) {
      await sleep(ACK_RETRY_MS);
    }
  }
  if (Number(body.sent) > 0) {
    throw new Error(lastMessage);
  }
}

export default {
  async scheduled(_event, env) {
    try {
      await runIngest(env);
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      console.error(`scheduled failed: ${message}`);
      throw err;
    }
  },

  async fetch(request, env) {
    const provided = request.headers.get('X-Eth-Ma-Ingest-Secret') || '';
    if (!secretsEqual(provided, env.ETH_MA_INGEST_SECRET)) {
      return new Response('unauthorized', { status: 401 });
    }
    try {
      const result = await runIngest(env);
      return new Response(JSON.stringify({ ok: true, ...result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
