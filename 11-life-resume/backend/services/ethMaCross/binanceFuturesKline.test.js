const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseRestKline,
  parseWsKlinePayload,
  isClosedKline,
  upsertClosedKline,
} = require('./binanceFuturesKline');

describe('parseRestKline', () => {
  it('reads open/close time and close price', () => {
    const row = [1000, '1', '2', '0.5', '1.5', '10', 1999];
    assert.deepEqual(parseRestKline(row), {
      openTime: 1000,
      closeTime: 1999,
      close: 1.5,
    });
  });
});

describe('parseWsKlinePayload', () => {
  it('accepts only closed ETHUSDT 15m bars', () => {
    const closed = {
      k: { t: 1000, T: 1999, c: '12.5', x: true, s: 'ETHUSDT', i: '15m' },
    };
    assert.deepEqual(parseWsKlinePayload(JSON.stringify(closed)), {
      openTime: 1000,
      closeTime: 1999,
      close: 12.5,
    });
    assert.equal(parseWsKlinePayload({ k: { ...closed.k, x: false } }), null);
    assert.equal(parseWsKlinePayload({ k: { ...closed.k, s: 'BTCUSDT' } }), null);
  });
});

describe('isClosedKline / upsertClosedKline', () => {
  it('treats a bar as closed only after closeTime', () => {
    assert.equal(isClosedKline({ closeTime: 50 }, 51), true);
    assert.equal(isClosedKline({ closeTime: 50 }, 50), false);
  });

  it('replaces the same openTime and keeps order', () => {
    const first = upsertClosedKline([], { openTime: 20, closeTime: 29, close: 2 });
    const second = upsertClosedKline(first, { openTime: 10, closeTime: 19, close: 1 });
    const third = upsertClosedKline(second, { openTime: 20, closeTime: 29, close: 3 });
    assert.deepEqual(
      third.map((k) => k.close),
      [1, 3]
    );
  });
});
