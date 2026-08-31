const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { smaAt, detectSmaCross, evaluateClosedCloses } = require('./smaCross');

describe('smaAt', () => {
  it('averages the trailing window', () => {
    assert.equal(smaAt([1, 2, 3, 4, 5], 3, 4), 4);
    assert.equal(smaAt([2, 4, 6], 3, 2), 4);
  });

  it('returns null when the window is incomplete', () => {
    assert.equal(smaAt([1, 2], 3, 1), null);
    assert.equal(smaAt([1, 2, 3], 3, 3), null);
  });
});

describe('detectSmaCross', () => {
  it('detects a golden cross only when MA7 actually rises through MA25', () => {
    assert.equal(detectSmaCross(9, 10, 11, 10), 'golden');
    assert.equal(detectSmaCross(10, 10, 11, 10), null);
    assert.equal(detectSmaCross(9, 10, 10, 10), null);
  });

  it('detects a death cross only when MA7 actually falls through MA25', () => {
    assert.equal(detectSmaCross(11, 10, 9, 10), 'death');
    assert.equal(detectSmaCross(10, 10, 9, 10), null);
    assert.equal(detectSmaCross(11, 10, 10, 10), null);
  });

  it('returns null when values are missing', () => {
    assert.equal(detectSmaCross(null, 10, 11, 10), null);
  });
});

describe('evaluateClosedCloses', () => {
  it('needs slowPeriod + 1 closed bars', () => {
    const closes = Array(25).fill(100);
    assert.deepEqual(evaluateClosedCloses(closes), { ok: false, reason: 'INSUFFICIENT_BARS' });
  });

  it('flags a golden cross on the last closed bar', () => {
    const closes = [
      ...Array(24).fill(100),
      90,
      120,
    ];
    const result = evaluateClosedCloses(closes);
    assert.equal(result.ok, true);
    assert.equal(result.cross, 'golden');
    assert.equal(result.close, 120);
    assert.ok(result.sma7 > result.sma25);
    assert.ok(result.prevSma7 < result.prevSma25);
  });

  it('flags a death cross on the last closed bar', () => {
    const closes = [
      ...Array(24).fill(100),
      110,
      80,
    ];
    const result = evaluateClosedCloses(closes);
    assert.equal(result.ok, true);
    assert.equal(result.cross, 'death');
    assert.ok(result.sma7 < result.sma25);
    assert.ok(result.prevSma7 > result.prevSma25);
  });

  it('does not fire when the last bar stays on the same side', () => {
    const closes = Array(26).fill(100);
    const result = evaluateClosedCloses(closes);
    assert.equal(result.ok, true);
    assert.equal(result.cross, null);
    assert.equal(result.sma7, 100);
    assert.equal(result.sma25, 100);
  });
});
