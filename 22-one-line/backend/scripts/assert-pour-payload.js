/**
 * Offline checks for pour payload + empty mood. No DB.
 * Usage: node scripts/assert-pour-payload.js
 */

const assert = require('assert');
const { assertPostBody } = require('../lib/postBody');
const {
  assertPourPayload,
  rejectBannedKeys,
  DURATION_MIN_SEC,
  durationMinSec,
} = require('../lib/pourPayload');

function throwsCode(fn, code) {
  try {
    fn();
  } catch (err) {
    assert.strictEqual(err.code, code, `expected ${code}, got ${err.code}: ${err.message}`);
    return;
  }
  throw new Error(`expected ${code}`);
}

const ok = {
  tableName: 'MAN',
  people: 12,
  names: Array(12).fill('GUESTX3'),
  durationSec: 7200,
  place: 'BKK',
  bottleCount: 2,
  consumedMl: 800,
  kinds: ['beer', 'soft'],
};

assert.deepStrictEqual(assertPourPayload(ok).kinds, ['beer', 'soft']);
assert.strictEqual(assertPourPayload({ ...ok, durationSec: 21600 }).durationSec, 21600);
assert.strictEqual(assertPourPayload({ ...ok, kinds: ['beer', 'beer'] }).kinds.length, 1);
assert.strictEqual(assertPostBody('', { allowEmpty: true }), '');
assert.strictEqual(assertPostBody('quiet night', { allowEmpty: true }), 'quiet night');

throwsCode(() => assertPostBody(''), 'BAD_BODY');
assert.strictEqual(DURATION_MIN_SEC, 7200);
const minSec = durationMinSec();
assert.strictEqual(assertPourPayload({ ...ok, durationSec: minSec }).durationSec, minSec);
throwsCode(() => assertPourPayload({ ...ok, durationSec: minSec - 1 }), 'BAD_POUR');
throwsCode(() => assertPourPayload({ ...ok, durationSec: 21601 }), 'BAD_POUR');
throwsCode(() => assertPourPayload({ ...ok, tableName: 'man' }), 'BAD_POUR');
throwsCode(() => assertPourPayload({ ...ok, tableName: 'TOOLONGNAMEZ' }), 'BAD_POUR');
throwsCode(() => assertPourPayload({ ...ok, people: 0 }), 'BAD_POUR');
throwsCode(() => assertPourPayload({ ...ok, people: 21, names: Array(21).fill('GUESTX3') }), 'BAD_POUR');
throwsCode(() => assertPourPayload({ ...ok, kinds: [] }), 'BAD_POUR');
throwsCode(() => assertPourPayload({ ...ok, kinds: ['gin'] }), 'BAD_POUR');
throwsCode(() => assertPourPayload({ ...ok, photoUrl: 'x' }), 'POUR_NO_MEDIA');
throwsCode(() => assertPourPayload({ ...ok, extra: 1 }), 'BAD_POUR');
assert.deepStrictEqual(assertPourPayload(ok).names, ok.names);
assert.strictEqual(assertPourPayload({ ...ok, names: [...ok.names.slice(0, 11), 'A1'] }).names[11], 'A1');
throwsCode(() => assertPourPayload({ ...ok, names: ok.names.slice(1) }), 'BAD_POUR');
throwsCode(() => assertPourPayload({ ...ok, names: [...ok.names.slice(0, 11), 'guestx3'] }), 'BAD_POUR');
const { names: _omitNames, ...okNoNames } = ok;
throwsCode(() => assertPourPayload(okNoNames), 'BAD_POUR');
throwsCode(() => rejectBannedKeys({ gps: 1 }), 'POUR_NO_MEDIA');
throwsCode(() => assertPourPayload({ ...ok, place: 'https://x.com' }), 'BODY_LINK');

console.log('assert-pour-payload: ok');
