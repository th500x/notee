const { query } = require('../../database/connection');
const { ETH_MA_CROSS } = require('../../constants/ethMaCross');
const { formatMaCrossSnapshot } = require('./formatSignal');

async function ensureStateRow() {
  await query(
    `INSERT INTO eth_ma_cross_state (id, symbol, kline_interval)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE symbol = VALUES(symbol), kline_interval = VALUES(kline_interval)`,
    [ETH_MA_CROSS.STATE_ROW_ID, ETH_MA_CROSS.SYMBOL, ETH_MA_CROSS.KLINE_INTERVAL]
  );
}

async function getStateRow() {
  await ensureStateRow();
  const rows = await query('SELECT * FROM eth_ma_cross_state WHERE id = ? LIMIT 1', [
    ETH_MA_CROSS.STATE_ROW_ID,
  ]);
  return rows[0] || null;
}

async function getLatestSnapshot() {
  const row = await getStateRow();
  return formatMaCrossSnapshot(row);
}

async function saveClosedBar(bar) {
  await ensureStateRow();
  await query(
    `UPDATE eth_ma_cross_state
     SET last_closed_open_time = ?,
         last_closed_close_time = ?,
         last_close = ?,
         last_sma7 = ?,
         last_sma25 = ?,
         last_bar_cross = ?
     WHERE id = ?`,
    [
      bar.closedOpenTime,
      bar.closedCloseTime,
      bar.close,
      bar.sma7,
      bar.sma25,
      bar.cross || null,
      ETH_MA_CROSS.STATE_ROW_ID,
    ]
  );

  if (!bar.cross) return;

  await query(
    `UPDATE eth_ma_cross_state
     SET last_signal_cross = ?,
         last_signal_open_time = ?,
         last_signal_close = ?,
         last_signal_sma7 = ?,
         last_signal_sma25 = ?,
         last_signal_at = ?
     WHERE id = ?`,
    [
      bar.cross,
      bar.closedOpenTime,
      bar.close,
      bar.sma7,
      bar.sma25,
      new Date(bar.closedCloseTime),
      ETH_MA_CROSS.STATE_ROW_ID,
    ]
  );
}

async function markNotified(closedOpenTime) {
  await query(
    'UPDATE eth_ma_cross_state SET last_notified_open_time = ? WHERE id = ?',
    [closedOpenTime, ETH_MA_CROSS.STATE_ROW_ID]
  );
}

module.exports = {
  ensureStateRow,
  getStateRow,
  getLatestSnapshot,
  saveClosedBar,
  markNotified,
};
