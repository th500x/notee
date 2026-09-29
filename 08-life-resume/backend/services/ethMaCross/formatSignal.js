const { ETH_MA_CROSS } = require('../../constants/ethMaCross');

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function crossLabels(cross) {
  if (cross === 'golden') return { kindLabel: '金叉', biasLabel: '看多' };
  if (cross === 'death') return { kindLabel: '死叉', biasLabel: '看空' };
  return { kindLabel: null, biasLabel: null };
}

function toNumberOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isFreshClosedBar(closedCloseTime, now = Date.now()) {
  const closeTime = Number(closedCloseTime);
  if (!Number.isFinite(closeTime)) return false;
  return now - closeTime <= ETH_MA_CROSS.FRESH_CLOSE_MS;
}

function formatMaCrossSnapshot(row) {
  if (!row) return null;
  const lastBarCross = row.last_bar_cross || null;
  const lastSignalCross = row.last_signal_cross || null;
  const lastLabels = crossLabels(lastSignalCross);
  return {
    symbol: row.symbol || ETH_MA_CROSS.SYMBOL,
    klineInterval: row.kline_interval || ETH_MA_CROSS.KLINE_INTERVAL,
    topic: ETH_MA_CROSS.TOPIC,
    lastClose: toNumberOrNull(row.last_close),
    lastSma7: toNumberOrNull(row.last_sma7),
    lastSma25: toNumberOrNull(row.last_sma25),
    lastClosedOpenTime: Number(row.last_closed_open_time) || 0,
    lastClosedCloseTime: Number(row.last_closed_close_time) || 0,
    lastBarCross,
    lastSignal: lastSignalCross
      ? {
          cross: lastSignalCross,
          kindLabel: lastLabels.kindLabel,
          biasLabel: lastLabels.biasLabel,
          closedOpenTime: Number(row.last_signal_open_time) || 0,
          close: toNumberOrNull(row.last_signal_close),
          sma7: toNumberOrNull(row.last_signal_sma7),
          sma25: toNumberOrNull(row.last_signal_sma25),
          at: row.last_signal_at ? new Date(row.last_signal_at).toISOString() : null,
        }
      : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function formatCrossSignalRow(row, extra = {}) {
  if (!row) return null;
  const cross = row.cross_kind || row.cross || null;
  const labels = crossLabels(cross);
  const openTime = Number(row.open_time) || 0;
  const closeTime = Number(row.close_time) || 0;
  return {
    openTime,
    closeTime,
    cross,
    kindLabel: labels.kindLabel,
    biasLabel: labels.biasLabel,
    close: toNumberOrNull(row.close),
    sma7: toNumberOrNull(row.sma7),
    sma25: toNumberOrNull(row.sma25),
    at: closeTime ? new Date(closeTime).toISOString() : null,
    ...extra,
  };
}

function formatPushPayload(signal) {
  const labels = crossLabels(signal.cross);
  return {
    title: `ETH ${signal.klineInterval} ${labels.kindLabel} · ${labels.biasLabel}`,
    body: `${signal.symbol} 收盘 ${formatPrice(signal.close)} · MA7 ${formatPrice(signal.sma7)} / MA25 ${formatPrice(signal.sma25)}`,
    url: ETH_MA_CROSS.OPEN_URL,
    tag: `eth-ma-${signal.closedOpenTime}`,
    topic: ETH_MA_CROSS.TOPIC,
    cross: signal.cross,
    kindLabel: labels.kindLabel,
    biasLabel: labels.biasLabel,
    symbol: signal.symbol,
    klineInterval: signal.klineInterval,
    close: signal.close,
    sma7: signal.sma7,
    sma25: signal.sma25,
    closedAt: new Date(signal.closedCloseTime).toISOString(),
  };
}

module.exports = {
  formatPrice,
  crossLabels,
  toNumberOrNull,
  isFreshClosedBar,
  formatMaCrossSnapshot,
  formatCrossSignalRow,
  formatPushPayload,
};
