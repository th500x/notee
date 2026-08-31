/**
 * 币安 U 本位永续 K 线：REST 灌入 + WS 收盘事件。
 */

const { ETH_MA_CROSS } = require('../../constants/ethMaCross');

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
  const url = `${ETH_MA_CROSS.REST_KLINES_URL}?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Binance klines HTTP ${res.status}`);
  }
  const rows = await res.json();
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
};
