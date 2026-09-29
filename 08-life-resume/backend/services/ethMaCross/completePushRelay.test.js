const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { shouldMarkNotified, normalizeGoneEndpoints } = require('./completePushRelay');

describe('shouldMarkNotified', () => {
  it('marks when at least one send succeeded', () => {
    assert.equal(shouldMarkNotified(1, 1, 0), true);
  });

  it('does not mark when the only attempt failed', () => {
    assert.equal(shouldMarkNotified(0, 1, 0), false);
  });

  it('marks when every remaining subscription is gone', () => {
    assert.equal(shouldMarkNotified(0, 0, 1), true);
  });
});

describe('normalizeGoneEndpoints', () => {
  it('keeps https endpoints only', () => {
    assert.deepEqual(normalizeGoneEndpoints(['https://fcm.googleapis.com/x', 'http://evil', '']), [
      'https://fcm.googleapis.com/x',
    ]);
  });
});
