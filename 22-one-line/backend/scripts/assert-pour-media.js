/**
 * Offline checks for pour square-crop rules. No DB.
 * Usage: node scripts/assert-pour-media.js
 */

const assert = require('assert');
const os = require('os');
const path = require('path');
const fsp = require('fs/promises');

process.env.POUR_MEDIA_DIR = path.join(os.tmpdir(), `pour-media-assert-${process.pid}`);

const {
  assertSittingId,
  assertSlot,
  assertJpeg,
  historySittingIds,
  MAX_BYTES,
} = require('../lib/pourMedia');
const store = require('../services/pourMediaStore');

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SIT = '11111111-1111-4111-8111-111111111111';
const SIT2 = '22222222-2222-4222-8222-222222222222';

assert.strictEqual(assertSittingId(SIT), SIT);
assert.throws(() => assertSittingId('../x'), (err) => err.code === 'POUR_CROP_BAD_ID');
assert.strictEqual(assertSlot('start'), 'start');
assert.strictEqual(assertSlot('end'), 'end');
assert.throws(() => assertSlot('photo'), (err) => err.code === 'POUR_CROP_BAD_SLOT');

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
assert.strictEqual(assertJpeg(jpeg), jpeg);
assert.throws(() => assertJpeg(Buffer.from('not-jpeg')), (err) => err.code === 'POUR_CROP_BAD_TYPE');
assert.throws(
  () => assertJpeg(Buffer.alloc(MAX_BYTES + 1, 0xff)),
  (err) => err.code === 'POUR_CROP_TOO_LARGE'
);

const ids = historySittingIds(
  JSON.stringify({
    v: 1,
    records: [{ id: SIT, startCrop: true }, { id: 'nope' }, { id: SIT }],
  })
);
assert.deepStrictEqual(ids, [SIT]);

(async () => {
  await store.put(USER, SIT, 'start', jpeg);
  await store.put(USER, SIT2, 'end', jpeg);
  assert.ok(store.exists(USER, SIT, 'start'));
  await store.pruneToIds(USER, [SIT]);
  assert.ok(store.exists(USER, SIT, 'start'));
  assert.ok(!store.exists(USER, SIT2, 'end'));
  await store.deleteUser(USER);
  assert.ok(!store.exists(USER, SIT, 'start'));
  await fsp.rm(process.env.POUR_MEDIA_DIR, { recursive: true, force: true });
  console.log('assert-pour-media: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
