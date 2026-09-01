/**
 * ETHUSDT 15m SMA(7)/SMA(25) 金叉死叉工人。
 * 独立进程；PM2 必须单实例。国内机访问不了币安时请停掉本进程，改用 Cloudflare Worker ingest。
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local'), override: true });
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../.env.production'), override: true });
}

const WebSocket = require('ws');
const { ETH_MA_CROSS } = require('../constants/ethMaCross');
const {
  fetchClosedKlines,
  parseWsKlinePayload,
  upsertClosedKline,
  formatNetError,
  resolveWsKlineUrl,
  getWsConnectOptions,
} = require('../services/ethMaCross/binanceFuturesKline');
const { MIN_BARS, applyClosedKlineSeries } = require('../services/ethMaCross/processBar');
const { ensureStateRow } = require('../services/ethMaCross/signalStateStore');
const { assertVapidConfigured } = require('../services/webPush/vapid');
const { closePool } = require('../database/connection');

const LOG = '[eth-ma-cross]';

let klines = [];
let socket = null;
let wsRetryMs = ETH_MA_CROSS.WS_RETRY_MIN_MS;
let wsHealthy = false;
let pollTimer = null;
let shuttingDown = false;

function log(...args) {
  console.log(LOG, ...args);
}

function logError(...args) {
  console.error(LOG, ...args);
}

async function applyBuffer() {
  return applyClosedKlineSeries(klines, {
    freshCloseMs: ETH_MA_CROSS.FRESH_CLOSE_MS,
    log: (message) => log(message),
  });
}

async function hydrateFromRest() {
  const closed = await fetchClosedKlines();
  klines = closed.reduce((acc, item) => upsertClosedKline(acc, item), []);
  log(`REST hydrated ${klines.length} closed ${ETH_MA_CROSS.KLINE_INTERVAL} bars`);
  if (klines.length < MIN_BARS) return;
  await applyBuffer();
}

function scheduleWsReconnect() {
  if (shuttingDown) return;
  const delay = wsRetryMs;
  wsRetryMs = Math.min(wsRetryMs * 2, ETH_MA_CROSS.WS_RETRY_MAX_MS);
  log(`WS reconnect in ${delay}ms`);
  setTimeout(connectWs, delay);
}

function connectWs() {
  if (shuttingDown) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  const wsUrl = resolveWsKlineUrl();
  socket = new WebSocket(wsUrl, getWsConnectOptions());

  socket.on('open', () => {
    wsHealthy = true;
    wsRetryMs = ETH_MA_CROSS.WS_RETRY_MIN_MS;
    log('WS open', wsUrl);
  });

  socket.on('message', (raw) => {
    const kline = parseWsKlinePayload(raw.toString());
    if (!kline) return;
    klines = upsertClosedKline(klines, kline);
    applyBuffer().catch((err) => logError('ws message', err.message));
  });

  socket.on('error', (err) => {
    logError('WS error', formatNetError(err));
  });

  socket.on('close', (code) => {
    wsHealthy = false;
    socket = null;
    log('WS closed', code);
    scheduleWsReconnect();
  });
}

async function pollRestFallback() {
  if (shuttingDown) return;
  if (wsHealthy && klines.length >= MIN_BARS) return;
  try {
    await hydrateFromRest();
  } catch (err) {
    logError('REST', formatNetError(err));
  }
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('shutdown', signal);
  if (pollTimer) clearInterval(pollTimer);
  if (socket) {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  }
  try {
    await closePool();
  } catch {
    /* ignore */
  }
  process.exit(0);
}

async function main() {
  assertVapidConfigured('eth-ma-cross-worker');
  await ensureStateRow();
  connectWs();
  pollTimer = setInterval(() => {
    pollRestFallback().catch((err) => logError('poll', formatNetError(err)));
  }, ETH_MA_CROSS.REST_POLL_MS);
  log('worker ready', ETH_MA_CROSS.SYMBOL, ETH_MA_CROSS.KLINE_INTERVAL);
  await pollRestFallback();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  logError('fatal', err.message);
  process.exit(1);
});
