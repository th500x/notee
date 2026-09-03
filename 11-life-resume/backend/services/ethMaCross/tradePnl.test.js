const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { crossDirection, roundPnl, suggestTradePnl } = require('./tradePnl');

describe('crossDirection', () => {
  it('maps golden to long and death to short', () => {
    assert.equal(crossDirection('golden'), 1);
    assert.equal(crossDirection('death'), -1);
    assert.equal(crossDirection(null), null);
  });
});

describe('suggestTradePnl', () => {
  it('uses direction × (exit − entry) × quantity', () => {
    assert.equal(
      suggestTradePnl({ cross: 'golden', entryPrice: 2400, exitPrice: 2450, quantity: 2 }),
      100
    );
    assert.equal(
      suggestTradePnl({ cross: 'death', entryPrice: 2400, exitPrice: 2350, quantity: 2 }),
      100
    );
    assert.equal(
      suggestTradePnl({ cross: 'death', entryPrice: 2400, exitPrice: 2450, quantity: 1 }),
      -50
    );
  });

  it('returns null when an input is missing', () => {
    assert.equal(
      suggestTradePnl({ cross: 'golden', entryPrice: 2400, exitPrice: null, quantity: 1 }),
      null
    );
  });
});

describe('roundPnl', () => {
  it('keeps two decimal places', () => {
    assert.equal(roundPnl(10.126), 10.13);
    assert.equal(roundPnl(Number.NaN), null);
  });
});
