const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  INTERVAL_MS,
  barFromOpen,
  parseGatePayload,
  parseBybitPayload,
  keepClosedSorted,
} = require('./ingestPublicKlines');

describe('barFromOpen', () => {
  it('sets closeTime to the last ms of a 1h bar', () => {
    assert.deepEqual(barFromOpen(1_000, '12.5'), {
      openTime: 1_000,
      closeTime: 1_000 + INTERVAL_MS - 1,
      close: 12.5,
    });
  });
});

describe('parseGatePayload', () => {
  it('treats t as seconds when below 1e12', () => {
    const rows = parseGatePayload([{ t: 1, o: '1', c: '2.25' }]);
    assert.deepEqual(rows, [barFromOpen(1000, 2.25)]);
  });
});

describe('parseBybitPayload', () => {
  it('reads list rows newest-first without sorting', () => {
    const rows = parseBybitPayload({
      retCode: 0,
      result: {
        list: [
          ['2000', '1', '2', '0.5', '9', '1', '1'],
          ['1000', '1', '2', '0.5', '8', '1', '1'],
        ],
      },
    });
    assert.equal(rows[0].close, 9);
    assert.equal(rows[1].close, 8);
  });
});

describe('keepClosedSorted', () => {
  it('drops the in-progress bar and sorts by openTime', () => {
    const openA = 10_000;
    const openB = 10_000 + INTERVAL_MS;
    const rows = [barFromOpen(openB, 2), barFromOpen(openA, 1)];
    const kept = keepClosedSorted(rows, openB + 1);
    assert.deepEqual(
      kept.map((item) => item.close),
      [1]
    );
  });
});
