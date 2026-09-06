/**
 * Offline checks for pet bag blobs. No DB.
 * Usage: node scripts/assert-pet-bag.js
 */

const assert = require('assert');
const {
  assertBagBlob,
  assertTonightDayKey,
  assertRevision,
  parseBody,
  publicBag,
} = require('../lib/petBagRules');

const glow = JSON.stringify({
  v: 1,
  pets: [
    {
      uid: 'abc123def4567890',
      species: 'bar_glow',
      size: 's',
      star: 0,
      char: 'quick',
      hpMax: 40,
      hp: 40,
      luck: 1,
      force: 4,
      speed: 5,
      hpAt: 1,
      gotAt: 1,
    },
  ],
});

assert.strictEqual(assertBagBlob(glow), glow);
assert.strictEqual(assertBagBlob(''), '');
assert.strictEqual(assertBagBlob(JSON.stringify({ v: 1, pets: [] })), JSON.stringify({ v: 1, pets: [] }));
assert.throws(() => assertBagBlob('{'), (err) => err.code === 'PET_BAG_BAD_BLOB');
assert.throws(() => assertBagBlob(JSON.stringify({ v: 1, pets: {} })), (err) => err.code === 'PET_BAG_BAD_BLOB');
assert.throws(
  () => assertBagBlob(JSON.stringify({ v: 1, pets: [{ uid: 'x', species: 'Bad Id' }] })),
  (err) => err.code === 'PET_BAG_BAD_BLOB'
);
assert.throws(
  () => assertBagBlob(JSON.stringify({ v: 1, pets: [{ uid: '', species: 'bar_glow' }] })),
  (err) => err.code === 'PET_BAG_BAD_BLOB'
);
assert.throws(
  () => assertBagBlob(JSON.stringify({ v: 1, pets: [{ uid: 'x', species: 'bar_glow', size: 'xl' }] })),
  (err) => err.code === 'PET_BAG_BAD_BLOB'
);
assert.throws(
  () => assertBagBlob(JSON.stringify({ v: 1, pets: [{ uid: 'x', species: 'bar_glow', star: 4 }] })),
  (err) => err.code === 'PET_BAG_BAD_BLOB'
);

assert.strictEqual(assertTonightDayKey('2026-09-06'), '2026-09-06');
assert.strictEqual(assertTonightDayKey(''), null);
assert.throws(() => assertTonightDayKey('20260906'), (err) => err.code === 'PET_BAG_BAD_DAY');

assert.strictEqual(assertRevision(3), 3);
assert.throws(() => assertRevision(0), (err) => err.code === 'PET_BAG_BAD_REVISION');

const parsed = parseBody({
  bagBlob: glow,
  welcomeClaimed: true,
  tonightDayKey: '2026-09-06',
  revision: 1,
});
assert.strictEqual(parsed.welcomeClaimed, true);
assert.strictEqual(parsed.tonightDayKey, '2026-09-06');

const empty = publicBag(null);
assert.strictEqual(empty.revision, 0);
assert.strictEqual(empty.welcomeClaimed, false);
assert.strictEqual(empty.bagBlob, null);
assert.strictEqual(empty.tonightDayKey, null);

console.log('assert-pet-bag: ok');
