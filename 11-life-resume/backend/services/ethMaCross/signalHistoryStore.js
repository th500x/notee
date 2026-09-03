const { query } = require('../../database/connection');
const { ETH_MA_CROSS } = require('../../constants/ethMaCross');
const { formatCrossSignalRow } = require('./formatSignal');

async function upsertCrossSignal(bar) {
  if (!bar || (bar.cross !== 'golden' && bar.cross !== 'death')) return;
  const openTime = Number(bar.closedOpenTime);
  const closeTime = Number(bar.closedCloseTime);
  const close = Number(bar.close);
  if (!Number.isFinite(openTime) || !Number.isFinite(closeTime) || !Number.isFinite(close)) {
    const err = new Error('交叉信号缺少 openTime / closeTime / close');
    err.code = 'BAD_CROSS_SIGNAL';
    throw err;
  }
  await query(
    `INSERT INTO eth_ma_cross_signals
      (open_time, close_time, symbol, kline_interval, cross_kind, close, sma7, sma25)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       close_time = VALUES(close_time),
       symbol = VALUES(symbol),
       kline_interval = VALUES(kline_interval),
       cross_kind = VALUES(cross_kind),
       close = VALUES(close),
       sma7 = VALUES(sma7),
       sma25 = VALUES(sma25)`,
    [
      openTime,
      closeTime,
      ETH_MA_CROSS.SYMBOL,
      ETH_MA_CROSS.KLINE_INTERVAL,
      bar.cross,
      close,
      Number.isFinite(Number(bar.sma7)) ? Number(bar.sma7) : null,
      Number.isFinite(Number(bar.sma25)) ? Number(bar.sma25) : null,
    ]
  );
}

async function getSignalByOpenTime(openTime) {
  const rows = await query(
    `SELECT open_time, close_time, symbol, kline_interval, cross_kind, close, sma7, sma25
     FROM eth_ma_cross_signals
     WHERE open_time = ?
     LIMIT 1`,
    [Number(openTime)]
  );
  return rows[0] || null;
}

async function listRecentSignalsForAccount(accountId, limit = ETH_MA_CROSS.RECENT_SIGNAL_LIMIT) {
  const cap = Math.min(Math.max(Number(limit) || ETH_MA_CROSS.RECENT_SIGNAL_LIMIT, 1), 100);
  const rows = await query(
    `SELECT
       s.open_time,
       s.close_time,
       s.cross_kind,
       s.close,
       s.sma7,
       s.sma25,
       t.id AS trade_id
     FROM eth_ma_cross_signals s
     LEFT JOIN eth_ma_trade_logs t
       ON t.signal_open_time = s.open_time AND t.account_id = ?
     ORDER BY s.open_time DESC
     LIMIT ?`,
    [accountId, cap]
  );
  return rows.map((row) =>
    formatCrossSignalRow(row, { hasTrade: Boolean(row.trade_id) })
  );
}

module.exports = {
  upsertCrossSignal,
  getSignalByOpenTime,
  listRecentSignalsForAccount,
};
