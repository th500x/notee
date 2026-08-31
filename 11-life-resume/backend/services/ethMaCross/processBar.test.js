const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { MIN_BARS, sortKlines } = require('./processBar');

describe('sortKlines', () => {
  it('drops invalid rows and sorts by openTime', () => {
    const sorted = sortKlines([
      { openTime: 20, closeTime: 29, close: 2 },
      { openTime: 'x', closeTime: 1, close: 1 },
      { openTime: 10, closeTime: 19, close: 1 },
    ]);
    assert.deepEqual(
      sorted.map((k) => k.close),
      [1, 2]
    );
  });
});

describe('MIN_BARS', () => {
  it('is SMA25 + 1', () => {
    assert.equal(MIN_BARS, 26);
  });
});
