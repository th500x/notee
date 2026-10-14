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

/**
 * 最后一根若是交叉：只有「上一轮」两条线曾经拉开到 minGap 美元，才算能开单。
 * 开单价就是这根收盘价，不把旧交叉留到以后再通知。
 * 上一轮最大间距不足 minGap，视为杂质，当场丢掉。
 */
function lastBarActionableCross(closes, minGap, options = {}) {
  const fastPeriod = options.fastPeriod || ETH_MA_CROSS.SMA_FAST;
  const slowPeriod = options.slowPeriod || ETH_MA_CROSS.SMA_SLOW;
  const gapMin = Number(minGap);
  if (!Number.isFinite(gapMin) || gapMin <= 0) {
    return { ok: false, reason: 'BAD_MIN_GAP' };
  }
  if (!Array.isArray(closes) || closes.length < slowPeriod + 1) {
    return { ok: false, reason: 'INSUFFICIENT_BARS' };
  }

  const last = closes.length - 1;
  let priorPeak = 0;
  let actionable = null;
  let priorPeakAtCross = null;
  for (let i = slowPeriod - 1; i <= last; i += 1) {
    const sma7 = smaAt(closes, fastPeriod, i);
    const sma25 = smaAt(closes, slowPeriod, i);
    if (sma7 == null || sma25 == null) {
      return { ok: false, reason: 'INVALID_CLOSE' };
    }
    const gap = Math.abs(sma7 - sma25);
    let cross = null;
    if (i >= slowPeriod) {
      const prevSma7 = smaAt(closes, fastPeriod, i - 1);
      const prevSma25 = smaAt(closes, slowPeriod, i - 1);
      if (prevSma7 == null || prevSma25 == null) {
        return { ok: false, reason: 'INVALID_CLOSE' };
      }
      cross = detectSmaCross(prevSma7, prevSma25, sma7, sma25);
    }
    if (cross) {
      if (i === last && priorPeak >= gapMin) {
        actionable = {
          cross,
          crossIndex: i,
          crossSma7: sma7,
          crossSma25: sma25,
          priorPeak,
        };
      }
      if (i === last) priorPeakAtCross = priorPeak;
      priorPeak = 0;
    } else {
      priorPeak = Math.max(priorPeak, gap);
    }
  }

  return { ok: true, actionable, priorPeak: priorPeakAtCross };
}

module.exports = {
  smaAt,
  detectSmaCross,
  evaluateClosedCloses,
  lastBarActionableCross,
};
