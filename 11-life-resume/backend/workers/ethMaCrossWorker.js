/**
 * ETHUSDT 15m SMA(7)/SMA(25) 金叉死叉工人。
 * 独立进程；PM2 必须单实例。收盘后立即推送。
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local'), override: true });
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../.env.production'), override: true });
}

const WebSocket = require('ws');
const { ETH_MA_CROSS } = require('../constants/ethMaCross');
const { evaluateClosedCloses } = require('../services/ethMaCross/smaCross');
const {
  fetchClosedKlines,
  parseWsKlinePayload,
  upsertClosedKline,
  formatNetError,
  resolveWsKlineUrl,
  getWsConnectOptions,
} = require('../services/ethMaCross/binanceFuturesKline');
const { formatPushPayload, isFreshClosedBar } = require('../services/ethMaCross/formatSignal');
const {
  ensureStateRow,
  getStateRow,
  saveClosedBar,
  markNotified,
} = require('../services/ethMaCross/signalStateStore');
const { sendMaCrossToSubscribers } = require('../services/webPush/sendService');
const { assertVapidConfigured } = require('../services/webPush/vapid');
const { closePool } = require('../database/connection');

const LOG = '[eth-ma-cross]';

let klines = [];
let socket = null;
let wsRetryMs = ETH_MA_CROSS.WS_RETRY_MIN_MS;
let wsHealthy = false;
let pollTimer = null;
let processing = false;
let shuttingDown = false;

function log(...args) {
  console.log(LOG, ...args);
}

function logError(...args) {
  console.error(LOG, ...args);
}

async function processClosedKline(kline, { allowStaleNotify = false } = {}) {
  if (!kline || processing) return;
  processing = true;
  try {
    const next = upsertClosedKline(klines, kline);
    const last = next[next.length - 1];
    if (!last || last.openTime !== kline.openTime) {
      klines = next;
      return;
    }
    klines = next;

    const state = await getStateRow();
    const alreadySaved = Number(state.last_closed_open_time) === kline.openTime;
    let bar;

    if (alreadySaved) {
      bar = {
        closedOpenTime: kline.openTime,
        closedCloseTime: Number(state.last_closed_close_time) || kline.closeTime,
        close: Number(state.last_close),
        sma7: Number(state.last_sma7),
        sma25: Number(state.last_sma25),
        cross: state.last_bar_cross || null,
      };
    } else {
      const evaluation = evaluateClosedCloses(klines.map((item) => item.close));
      if (!evaluation.ok) {
        return;
      }
      bar = {
        closedOpenTime: kline.openTime,
        closedCloseTime: kline.closeTime,
        close: evaluation.close,
        sma7: evaluation.sma7,
        sma25: evaluation.sma25,
        cross: evaluation.cross,
      };
      await saveClosedBar(bar);
      log(
        `closed ${new Date(kline.openTime).toISOString()} close=${bar.close} sma7=${bar.sma7.toFixed(4)} sma25=${bar.sma25.toFixed(4)} cross=${bar.cross || 'none'}`
      );
    }

    if (!bar.cross) {
      return;
    }

    const alreadyNotified = Number(state.last_notified_open_time) === kline.openTime;
    const fresh = allowStaleNotify || isFreshClosedBar(kline.closeTime);
    if (alreadyNotified || !fresh) {
      if (!alreadySaved) {
        log(`skip notify ${bar.cross} open=${kline.openTime} notified=${alreadyNotified} fresh=${fresh}`);
      }
      return;
    }

    const payload = formatPushPayload({
      symbol: ETH_MA_CROSS.SYMBOL,
      klineInterval: ETH_MA_CROSS.KLINE_INTERVAL,
      cross: bar.cross,
      close: bar.close,
      sma7: bar.sma7,
      sma25: bar.sma25,
      closedOpenTime: bar.closedOpenTime,
      closedCloseTime: bar.closedCloseTime,
    });
    const result = await sendMaCrossToSubscribers(payload);
    await markNotified(kline.openTime);
    log(
      `notify ${bar.cross} close=${bar.close} sent=${result.sent}/${result.total} gone=${result.gone} failed=${result.failed}`
    );
  } catch (err) {
    logError('processClosedKline', err.message);
  } finally {
    processing = false;
  }
}

function minBarsForSma() {
  return ETH_MA_CROSS.SMA_SLOW + 1;
}

async function hydrateFromRest() {
  const closed = await fetchClosedKlines();
  klines = closed.reduce((acc, item) => upsertClosedKline(acc, item), []);
  log(`REST hydrated ${klines.length} closed ${ETH_MA_CROSS.KLINE_INTERVAL} bars`);
  if (!klines.length) return;
  const latest = klines[klines.length - 1];
  await processClosedKline(latest, { allowStaleNotify: false });
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
    processClosedKline(kline).catch((err) => logError('ws message', err.message));
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
  if (wsHealthy && klines.length >= minBarsForSma()) return;
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
