/**
 * 按账号操作记录：仅「记一笔」写入；同一信号最多一笔。
 */

const { query } = require('../../database/connection');
const { toNumberOrNull, formatCrossSignalRow } = require('./formatSignal');
const { assertAccountAllowed } = require('../webPush/subscriptionService');
const { getSignalByOpenTime, listRecentSignalsForAccount } = require('./signalHistoryStore');
const { suggestTradePnl } = require('./tradePnl');

class TradeLogError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'TradeLogError';
    this.code = code;
    this.status = status;
  }
}

function parsePositiveNumber(value, field, label) {
  if (value == null || value === '') {
    throw new TradeLogError('BAD_TRADE_FIELD', `请填写${label}`);
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new TradeLogError('BAD_TRADE_FIELD', `${label}须为正数`);
  }
  return n;
}

function parseOptionalPositiveNumber(value, label) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new TradeLogError('BAD_TRADE_FIELD', `${label}须为正数或留空`);
  }
  return n;
}

function parseOptionalNumber(value, label) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new TradeLogError('BAD_TRADE_FIELD', `${label}须为数字或留空`);
  }
  return n;
}

function parseClosedOn(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new TradeLogError('BAD_CLOSED_ON', '平仓日期格式应为 YYYY-MM-DD');
  }
  return text;
}

function parseSignalOpenTime(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new TradeLogError('BAD_SIGNAL', '缺少有效的信号时间');
  }
  return n;
}

function parseTradeInput(body) {
  const payload = body && typeof body === 'object' ? body : {};
  return {
    signalOpenTime: parseSignalOpenTime(payload.signalOpenTime),
    entryPrice: parsePositiveNumber(payload.entryPrice, 'entryPrice', '购买价格'),
    quantity: parsePositiveNumber(payload.quantity, 'quantity', '数量'),
    takeProfitPrice: parsePositiveNumber(payload.takeProfitPrice, 'takeProfitPrice', '止盈价'),
    stopLossPrice: parseOptionalPositiveNumber(payload.stopLossPrice, '止损价'),
    closedOn: parseClosedOn(payload.closedOn),
    pnl: parseOptionalNumber(payload.pnl, '最终收益'),
  };
}

function formatClosedOn(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  return null;
}

function formatTradeLog(row) {
  if (!row) return null;
  const signal = formatCrossSignalRow({
    open_time: row.signal_open_time,
    close_time: row.signal_close_time,
    cross_kind: row.cross_kind,
    close: row.signal_close,
    sma7: row.signal_sma7,
    sma25: row.signal_sma25,
  });
  const entryPrice = toNumberOrNull(row.entry_price);
  const quantity = toNumberOrNull(row.quantity);
  const takeProfitPrice = toNumberOrNull(row.take_profit_price);
  const stopLossPrice = toNumberOrNull(row.stop_loss_price);
  const cross = signal ? signal.cross : null;
  return {
    id: Number(row.id) || 0,
    accountId: String(row.account_id || '').toUpperCase(),
    signalOpenTime: Number(row.signal_open_time) || 0,
    entryPrice,
    quantity,
    takeProfitPrice,
    stopLossPrice,
    closedOn: formatClosedOn(row.closed_on),
    pnl: toNumberOrNull(row.pnl),
    suggestedPnlAtTakeProfit: suggestTradePnl({
      cross,
      entryPrice,
      exitPrice: takeProfitPrice,
      quantity,
    }),
    suggestedPnlAtStopLoss: suggestTradePnl({
      cross,
      entryPrice,
      exitPrice: stopLossPrice,
      quantity,
    }),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    signal,
  };
}

const TRADE_SELECT = `SELECT
       t.id,
       t.account_id,
       t.signal_open_time,
       t.entry_price,
       t.quantity,
       t.take_profit_price,
       t.stop_loss_price,
       DATE_FORMAT(t.closed_on, '%Y-%m-%d') AS closed_on,
       t.pnl,
       t.created_at,
       t.updated_at,
       s.close_time AS signal_close_time,
       s.cross_kind,
       s.close AS signal_close,
       s.sma7 AS signal_sma7,
       s.sma25 AS signal_sma25
     FROM eth_ma_trade_logs t
     INNER JOIN eth_ma_cross_signals s ON s.open_time = t.signal_open_time`;

async function getTradeForAccount(accountId, signalOpenTime) {
  const rows = await query(
    `${TRADE_SELECT}
     WHERE t.account_id = ? AND t.signal_open_time = ?
     LIMIT 1`,
    [accountId, signalOpenTime]
  );
  return rows[0] ? formatTradeLog(rows[0]) : null;
}

async function listTradesForAccount(accountId) {
  const rows = await query(
    `${TRADE_SELECT}
     WHERE t.account_id = ?
     ORDER BY t.signal_open_time DESC`,
    [accountId]
  );
  return rows.map(formatTradeLog);
}

async function getTradesJournal(accountId) {
  const id = assertAccountAllowed(accountId);
  const [recentSignals, trades] = await Promise.all([
    listRecentSignalsForAccount(id),
    listTradesForAccount(id),
  ]);
  return { recentSignals, trades };
}

async function upsertTrade(accountId, body) {
  const id = assertAccountAllowed(accountId);
  const input = parseTradeInput(body);
  const signal = await getSignalByOpenTime(input.signalOpenTime);
  if (!signal) {
    throw new TradeLogError('SIGNAL_NOT_FOUND', '没有这条交叉信号', 404);
  }
  await query(
    `INSERT INTO eth_ma_trade_logs
      (account_id, signal_open_time, entry_price, quantity, take_profit_price, stop_loss_price, closed_on, pnl)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       entry_price = VALUES(entry_price),
       quantity = VALUES(quantity),
       take_profit_price = VALUES(take_profit_price),
       stop_loss_price = VALUES(stop_loss_price),
       closed_on = VALUES(closed_on),
       pnl = VALUES(pnl)`,
    [
      id,
      input.signalOpenTime,
      input.entryPrice,
      input.quantity,
      input.takeProfitPrice,
      input.stopLossPrice,
      input.closedOn,
      input.pnl,
    ]
  );
  const saved = await getTradeForAccount(id, input.signalOpenTime);
  if (!saved) {
    throw new TradeLogError('TRADE_SAVE_FAILED', '保存后未能读回记录', 500);
  }
  return saved;
}

async function deleteTrade(accountId, signalOpenTime) {
  const id = assertAccountAllowed(accountId);
  const openTime = parseSignalOpenTime(signalOpenTime);
  const result = await query(
    'DELETE FROM eth_ma_trade_logs WHERE account_id = ? AND signal_open_time = ?',
    [id, openTime]
  );
  if (!result.affectedRows) {
    throw new TradeLogError('TRADE_NOT_FOUND', '没有这笔操作记录', 404);
  }
  return { deleted: true, signalOpenTime: openTime };
}

module.exports = {
  TradeLogError,
  parseTradeInput,
  formatTradeLog,
  getTradesJournal,
  upsertTrade,
  deleteTrade,
};
