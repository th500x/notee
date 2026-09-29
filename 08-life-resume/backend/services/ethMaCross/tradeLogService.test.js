const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseTradeInput, formatTradeLog, TradeLogError } = require('./tradeLogService');

describe('parseTradeInput', () => {
  const base = {
    signalOpenTime: 1756889999000,
    entryPrice: 2403.62,
    quantity: 0.5,
    takeProfitPrice: 2500,
  };

  it('accepts a complete payload and leaves optional fields null', () => {
    assert.deepEqual(parseTradeInput(base), {
      signalOpenTime: 1756889999000,
      entryPrice: 2403.62,
      quantity: 0.5,
      takeProfitPrice: 2500,
      stopLossPrice: null,
      closedOn: null,
      pnl: null,
    });
  });

  it('parses optional stop, date, and signed pnl', () => {
    const parsed = parseTradeInput({
      ...base,
      stopLossPrice: 2300,
      closedOn: '2026-09-03',
      pnl: -12.5,
    });
    assert.equal(parsed.stopLossPrice, 2300);
    assert.equal(parsed.closedOn, '2026-09-03');
    assert.equal(parsed.pnl, -12.5);
  });

  it('rejects a missing take-profit price', () => {
    assert.throws(
      () => parseTradeInput({ ...base, takeProfitPrice: '' }),
      (err) => err instanceof TradeLogError && err.code === 'BAD_TRADE_FIELD'
    );
  });
});

describe('formatTradeLog', () => {
  it('maps snake_case rows to camelCase and fills suggested pnl', () => {
    const trade = formatTradeLog({
      id: 8,
      account_id: '0996',
      signal_open_time: 1000,
      entry_price: '2400.00000000',
      quantity: '1.00000000',
      take_profit_price: '2450.00000000',
      stop_loss_price: '2350.00000000',
      closed_on: '2026-09-03',
      pnl: '40.00000000',
      created_at: '2026-09-03T06:00:00.000Z',
      updated_at: '2026-09-03T06:00:00.000Z',
      signal_close_time: 4599999,
      cross_kind: 'golden',
      signal_close: '2403.62000000',
      signal_sma7: '2401',
      signal_sma25: '2390',
    });
    assert.equal(trade.accountId, '0996');
    assert.equal(trade.entryPrice, 2400);
    assert.equal(trade.closedOn, '2026-09-03');
    assert.equal(trade.suggestedPnlAtTakeProfit, 50);
    assert.equal(trade.suggestedPnlAtStopLoss, -50);
    assert.equal(trade.signal.kindLabel, '金叉');
    assert.equal(trade.signal.close, 2403.62);
  });
});
