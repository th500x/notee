/**
 * Offline checks for stamp bag blobs. No DB.
 * Usage: node scripts/assert-stamp-bag.js
 */

const assert = require('assert');
const {
  assertInventoryBlob,
  assertCheckInBlob,
  assertGiftClaimedIds,
  assertRevision,
  parseBody,
  publicBag,
} = require('../lib/stampBagRules');

assert.strictEqual(
  assertInventoryBlob('v2|th_bangkok:3|th_lopburi|2|0'),
  'v2|th_bangkok:3|th_lopburi|2|0'
);
assert.strictEqual(assertInventoryBlob(''), '');
assert.throws(() => assertInventoryBlob('nope'), (err) => err.code === 'STAMP_BAG_BAD_BLOB');
assert.throws(() => assertInventoryBlob('v2|TH_BANGKOK:1||0|0'), (err) => err.code === 'STAMP_BAG_BAD_BLOB');

assert.strictEqual(
  assertCheckInBlob('v2|th_chiang_mai|2026-08-21|2026-08-21||rotation|'),
  'v2|th_chiang_mai|2026-08-21|2026-08-21||rotation|'
);
assert.strictEqual(assertCheckInBlob(''), null);
assert.throws(() => assertCheckInBlob('v2|bad|2026-08-21|||'), (err) => err.code === 'STAMP_BAG_BAD_BLOB');

assert.strictEqual(
  assertGiftClaimedIds('11111111-1111-4111-8111-111111111111,11111111-1111-4111-8111-111111111111'),
  '11111111-1111-4111-8111-111111111111'
);
assert.throws(() => assertGiftClaimedIds('not-a-uuid'), (err) => err.code === 'STAMP_BAG_BAD_BLOB');

assert.strictEqual(assertRevision(3), 3);
assert.throws(() => assertRevision(0), (err) => err.code === 'STAMP_BAG_BAD_REVISION');

const parsed = parseBody({
  inventoryBlob: 'v2||th_bangkok|0|0',
  welcomePicked: true,
  revision: 1,
});
assert.strictEqual(parsed.welcomePicked, true);
assert.strictEqual(parsed.checkInBlob, null);

const empty = publicBag(null);
assert.strictEqual(empty.revision, 0);
assert.strictEqual(empty.welcomePicked, false);

console.log('assert-stamp-bag: ok');
