/**
 * ETHUSDT 1h SMA(7)/SMA(25) 金叉死叉工人（PM2：00-eth-worker）。
 * 入口在仓库根 workers/（.cjs，因根 package.json 为 type:module）；
 * 业务模块与 .env 仍用 08-life-resume/backend（全站 00）。
 * 须单实例；由仓库根 ecosystem.config.cjs 启动。
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
let wsHealthy = false;
let pollTimer = null;
let shuttingDown = false;

function log(...args) {
  console.log(LOG, ...args);
}

function logError(...args) {
  console.error(LOG, ...args);
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
  // REST 路径用更长追赶窗口：WS 假健康漏收盘时仍能补推
  await applyBuffer({
    freshCloseMs:
      options.freshCloseMs != null
        ? options.freshCloseMs
        : ETH_MA_CROSS.CATCHUP_FRESH_CLOSE_MS,
  });
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
  // 不得因 wsHealthy 跳过 REST：半开/静默 WS 会漏掉每小时收盘且永不 close。
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
  assertVapidConfigured('00-eth-worker');
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
