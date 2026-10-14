const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { smaAt, detectSmaCross, evaluateClosedCloses, lastBarConfirmedCross } = require('./smaCross');

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

describe('lastBarConfirmedCross', () => {
  const periods = { fastPeriod: 2, slowPeriod: 3 };
  const base = [1, 2, 3, 4, 5];

  it('rejects a non-positive gap', () => {
    const result = lastBarConfirmedCross([1, 2, 3, 4], 0, periods);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'BAD_MIN_GAP');
  });

  it('does not confirm a cross whose gap stays under 10', () => {
    const closes = [...base, 0];
    const result = lastBarConfirmedCross(closes, 10, periods);
    assert.equal(result.ok, true);
    assert.equal(result.confirmed, null);
    assert.equal(evaluateClosedCloses(closes, periods).cross, 'death');
  });

  it('drops the swing when price crosses back before the gap reaches 10', () => {
    const closes = [...base, 0, 20];
    const result = lastBarConfirmedCross(closes, 10, periods);
    assert.equal(result.ok, true);
    assert.equal(result.confirmed, null);
    assert.equal(evaluateClosedCloses(closes, periods).cross, 'golden');
  });

  it('confirms on the later bar where the gap first reaches 10', () => {
    const before = [...base, 0, -30];
    const at = [...before, -30];
    assert.equal(lastBarConfirmedCross(before, 10, periods).confirmed, null);
    const result = lastBarConfirmedCross(at, 10, periods);
    assert.equal(result.ok, true);
    assert.equal(result.confirmed.cross, 'death');
    assert.equal(result.confirmed.crossIndex, 5);
    assert.equal(result.confirmed.confirmIndex, 7);
  });

  it('does not confirm again on bars after the gap already reached 10', () => {
    const closes = [...base, 0, -30, -30, -30];
    const result = lastBarConfirmedCross(closes, 10, periods);
    assert.equal(result.ok, true);
    assert.equal(result.confirmed, null);
  });

  it('confirms on the cross bar itself when that bar already gaps by 10', () => {
    const closes = [...base, -100];
    const result = lastBarConfirmedCross(closes, 10, periods);
    assert.equal(result.ok, true);
    assert.equal(result.confirmed.cross, 'death');
    assert.equal(result.confirmed.crossIndex, 5);
    assert.equal(result.confirmed.confirmIndex, 5);
  });
});
