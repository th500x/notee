/**
 * Ranking identity. No database.
 * Usage: node scripts/assert-game-results.js
 */

const assert = require('assert');
const { prepareRounds } = require('../lib/gameResults');

const ACCOUNT = '11111111-1111-1111-1111-111111111111';
const INSTALL = '22222222-2222-2222-2222-222222222222';

function round(extra) {
  return {
    gameId: 'memory_flip',
    role: 'host',
    outcome: 'clear',
    attempts: 12,
    elapsedMs: 40000,
    percentile: 50,
    penalty: null,
    playerCount: 2,
    flagId: 'th',
    genderId: 'male',
    recordedAt: Date.UTC(2026, 10, 18),
    ...extra,
  };
}

function codeOf(fn) {
  try {
    fn();
  } catch (err) {
    return err.code;
  }
  return null;
}

const anon = prepareRounds([round()], ACCOUNT)[0];
assert.strictEqual(anon.userId, null);
assert.strictEqual(anon.installId, null);

const ranked = prepareRounds(
  [round({ nickName: 'CHRIS', installId: INSTALL })],
  ACCOUNT
)[0];
assert.strictEqual(ranked.userId, ACCOUNT);
assert.strictEqual(ranked.nickName, 'CHRIS');
assert.strictEqual(ranked.installId, INSTALL);

const mixed = prepareRounds(
  [
    round({ role: 'player', nickName: null, installId: null }),
    round({ nickName: 'CHRIS', installId: INSTALL, gameId: 'candy_hour' }),
  ],
  ACCOUNT
);
assert.strictEqual(mixed[0].userId, null);
assert.strictEqual(mixed[0].role, 'player');
assert.strictEqual(mixed[1].userId, ACCOUNT);
assert.strictEqual(mixed[1].gameId, 'candy_hour');

assert.strictEqual(
  codeOf(() => prepareRounds([round({ nickName: 'CHRIS', installId: INSTALL })], null)),
  'RANKING_AUTH_REQUIRED'
);
assert.strictEqual(
  codeOf(() => prepareRounds([round({ role: 'player', nickName: 'GUEST' })], ACCOUNT)),
  'GUEST_IDENTITY'
);
assert.strictEqual(
  codeOf(() => prepareRounds([round({ partyId: 'p1' })], ACCOUNT)),
  'BAD_ROUND_KEY'
);
assert.strictEqual(
  codeOf(() => prepareRounds([round({ userId: ACCOUNT, installId: INSTALL })], ACCOUNT)),
  'BAD_ROUND_KEY'
);
assert.strictEqual(
  codeOf(() => prepareRounds([round({ loginId: 'AB12', installId: INSTALL })], ACCOUNT)),
  'BAD_ROUND_KEY'
);
assert.strictEqual(
  codeOf(() => prepareRounds([round({ gameId: 'tank_clash' })], ACCOUNT)),
  'BAD_GAME'
);
assert.strictEqual(
  codeOf(() => prepareRounds([round({ gameId: 'candy_spots' })], ACCOUNT)),
  null
);

console.log('game results ok');
