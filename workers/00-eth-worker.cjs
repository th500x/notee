/**
 * ETHUSDT 1h SMA(7)/SMA(25) 金叉死叉工人（PM2：00-eth-worker）。
 * 入口在仓库根 workers/（.cjs，因根 package.json 为 type:module）；
 * 业务模块与 .env 仍用 08-life-resume/backend（全站 00）。
 * 须单实例；由仓库根 ecosystem.config.cjs 启动。
 *
 * 健康模型：以「最近是否收到过 WS 消息」为准，不以 socket.open 为准。
 * REST 在假死/未连接时追赶；WS 正常时仅低频对账。
 */

const path = require('path');
const Module = require('module');

const backendRoot = path.join(__dirname, '..', '08-life-resume', 'backend');
const backendNodeModules = path.join(backendRoot, 'node_modules');
module.paths.unshift(backendNodeModules);
const nodeModulePaths = Module._nodeModulePaths;
Module._nodeModulePaths = function patchedNodeModulePaths(from) {
  const paths = nodeModulePaths.call(this, from);
  if (!paths.includes(backendNodeModules)) paths.unshift(backendNodeModules);
  return paths;
};

require('dotenv').config({ path: path.join(backendRoot, '.env') });
require('dotenv').config({ path: path.join(backendRoot, '.env.local'), override: true });
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: path.join(backendRoot, '.env.production'), override: true });
}

const WebSocket = require('ws');
const { ETH_MA_CROSS } = require(path.join(backendRoot, 'constants/ethMaCross'));
const {
  fetchClosedKlines,
  parseWsKlinePayload,
  upsertClosedKline,
  formatNetError,
  resolveWsKlineUrl,
  getWsConnectOptions,
} = require(path.join(backendRoot, 'services/ethMaCross/binanceFuturesKline'));
const { MIN_BARS, applyClosedKlineSeries } = require(path.join(
  backendRoot,
  'services/ethMaCross/processBar'
));
const { ensureStateRow } = require(path.join(backendRoot, 'services/ethMaCross/signalStateStore'));
const { assertVapidConfigured } = require(path.join(backendRoot, 'services/webPush/vapid'));
const { closePool } = require(path.join(backendRoot, 'database/connection'));

const LOG = '[00-eth-worker]';

let klines = [];
let socket = null;
let wsRetryMs = ETH_MA_CROSS.WS_RETRY_MIN_MS;
/** 最近一次收到任意 WS 帧的时间；仅 open 不算健康 */
let lastWsActivityAt = 0;
let lastHealthyRestAt = 0;
let pollTimer = null;
let shuttingDown = false;
let reconnectTimer = null;

function log(...args) {
  console.log(LOG, ...args);
}

function logError(...args) {
  console.error(LOG, ...args);
}

function isWsSocketOpen() {
  return Boolean(socket && socket.readyState === WebSocket.OPEN);
}

/** 有近期消息才算活着；光 open 不算。 */
function isWsLive(now = Date.now()) {
  if (!isWsSocketOpen() || !lastWsActivityAt) return false;
  return now - lastWsActivityAt <= ETH_MA_CROSS.WS_STALE_MS;
}

async function applyBuffer(options = {}) {
  return applyClosedKlineSeries(klines, {
    freshCloseMs:
      options.freshCloseMs != null ? options.freshCloseMs : ETH_MA_CROSS.FRESH_CLOSE_MS,
    log: (message) => log(message),
  });
}

async function hydrateFromRest(options = {}) {
  const closed = await fetchClosedKlines();
  klines = closed.reduce((acc, item) => upsertClosedKline(acc, item), []);
  log(`REST hydrated ${klines.length} closed ${ETH_MA_CROSS.KLINE_INTERVAL} bars`);
  if (klines.length < MIN_BARS) return;
  await applyBuffer({
    freshCloseMs:
      options.freshCloseMs != null
        ? options.freshCloseMs
        : ETH_MA_CROSS.CATCHUP_FRESH_CLOSE_MS,
  });
}

function scheduleWsReconnect() {
  if (shuttingDown) return;
  if (reconnectTimer) return;
  const delay = wsRetryMs;
  wsRetryMs = Math.min(wsRetryMs * 2, ETH_MA_CROSS.WS_RETRY_MAX_MS);
  log(`WS reconnect in ${delay}ms`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWs();
  }, delay);
}

function forceWsReconnect(reason) {
  if (shuttingDown) return;
  lastWsActivityAt = 0;
  log(`WS force reconnect: ${reason}`);
  if (socket) {
    const old = socket;
    socket = null;
    try {
      old.removeAllListeners();
      old.terminate();
    } catch {
      /* ignore */
    }
  }
  scheduleWsReconnect();
}

function connectWs() {
  if (shuttingDown) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  const wsUrl = resolveWsKlineUrl();
  socket = new WebSocket(wsUrl, getWsConnectOptions());

  socket.on('open', () => {
    // open 只表示握手成功；真正健康要等首帧消息刷新 lastWsActivityAt
    lastWsActivityAt = Date.now();
    wsRetryMs = ETH_MA_CROSS.WS_RETRY_MIN_MS;
    log('WS open', wsUrl);
  });

  socket.on('message', (raw) => {
    lastWsActivityAt = Date.now();
    const kline = parseWsKlinePayload(raw.toString());
    if (!kline) return;
    klines = upsertClosedKline(klines, kline);
    applyBuffer().catch((err) => logError('ws message', err.message));
  });

  socket.on('error', (err) => {
    logError('WS error', formatNetError(err));
  });

  socket.on('close', (code) => {
    lastWsActivityAt = 0;
    socket = null;
    log('WS closed', code);
    scheduleWsReconnect();
  });
}

async function pollTick() {
  if (shuttingDown) return;
  const now = Date.now();

  if (isWsSocketOpen() && lastWsActivityAt && now - lastWsActivityAt > ETH_MA_CROSS.WS_STALE_MS) {
    forceWsReconnect(`no message for ${now - lastWsActivityAt}ms`);
    try {
      await hydrateFromRest();
    } catch (err) {
      logError('REST', formatNetError(err));
    }
    return;
  }

  if (!isWsLive(now)) {
    try {
      await hydrateFromRest();
    } catch (err) {
      logError('REST', formatNetError(err));
    }
    return;
  }

  if (now - lastHealthyRestAt >= ETH_MA_CROSS.REST_HEALTHY_INTERVAL_MS) {
    lastHealthyRestAt = now;
    try {
      await hydrateFromRest();
    } catch (err) {
      logError('REST', formatNetError(err));
    }
  }
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('shutdown', signal);
  if (pollTimer) clearInterval(pollTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
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
  assertVapidConfigured('00-eth-worker');
  await ensureStateRow();
  connectWs();
  pollTimer = setInterval(() => {
    pollTick().catch((err) => logError('poll', formatNetError(err)));
  }, ETH_MA_CROSS.REST_POLL_MS);
  log('worker ready', ETH_MA_CROSS.SYMBOL, ETH_MA_CROSS.KLINE_INTERVAL);
  await pollTick();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  logError('fatal', err.message);
  process.exit(1);
});
