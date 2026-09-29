/**
 * 已收盘收盘价上的 SMA(7)/SMA(25) 与金叉/死叉。
 * 只处理调用方保证「全是已收盘柱」的 closes 数组。
 */

const { ETH_MA_CROSS } = require('../../constants/ethMaCross');

function smaAt(closes, period, endIndex) {
  if (!Array.isArray(closes) || !Number.isInteger(endIndex)) return null;
  if (endIndex < period - 1 || endIndex >= closes.length) return null;
  let sum = 0;
  for (let i = endIndex - period + 1; i <= endIndex; i += 1) {
    const value = Number(closes[i]);
    if (!Number.isFinite(value)) return null;
    sum += value;
  }
  return sum / period;
}

/**
 * 须真正穿过。贴线（相等）不算交叉。
 * @returns {'golden'|'death'|null}
 */
function detectSmaCross(prevFast, prevSlow, fast, slow) {
  const raw = [prevFast, prevSlow, fast, slow];
  if (raw.some((v) => v == null || v === '')) return null;
  const values = raw.map((v) => Number(v));
  if (values.some((v) => !Number.isFinite(v))) return null;
  const [prevSma7, prevSma25, sma7, sma25] = values;
  if (prevSma7 < prevSma25 && sma7 > sma25) return 'golden';
  if (prevSma7 > prevSma25 && sma7 < sma25) return 'death';
  return null;
}

function evaluateClosedCloses(closes, options = {}) {
  const fastPeriod = options.fastPeriod || ETH_MA_CROSS.SMA_FAST;
  const slowPeriod = options.slowPeriod || ETH_MA_CROSS.SMA_SLOW;
  if (!Array.isArray(closes) || closes.length < slowPeriod + 1) {
    return { ok: false, reason: 'INSUFFICIENT_BARS' };
  }
  const i = closes.length - 1;
  const sma7 = smaAt(closes, fastPeriod, i);
  const sma25 = smaAt(closes, slowPeriod, i);
  const prevSma7 = smaAt(closes, fastPeriod, i - 1);
  const prevSma25 = smaAt(closes, slowPeriod, i - 1);
  const close = Number(closes[i]);
  if (!Number.isFinite(close) || sma7 == null || sma25 == null) {
    return { ok: false, reason: 'INVALID_CLOSE' };
  }
  return {
    ok: true,
    close,
    sma7,
    sma25,
    prevSma7,
    prevSma25,
    cross: detectSmaCross(prevSma7, prevSma25, sma7, sma25),
  };
}

module.exports = {
  smaAt,
  detectSmaCross,
  evaluateClosedCloses,
};
