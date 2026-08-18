/**
 * Offline checks for sequential prefix-batch login ids. No DB.
 * Usage: node scripts/assert-login-id.js
 */

const assert = require('assert');
const {
  REGULAR_FIRST_CHARSET,
  VIP_FIRST_CHARSET,
  PREFIX_CAPACITY,
  capacityOfPrefix,
  currentPrefixFromOccupancy,
  randomLoginIdBatch,
} = require('../lib/loginId');

assert.strictEqual(PREFIX_CAPACITY, 36 ** 3);

assert.strictEqual(currentPrefixFromOccupancy(REGULAR_FIRST_CHARSET, {}), 'A');
assert.strictEqual(currentPrefixFromOccupancy(VIP_FIRST_CHARSET, {}), '0');

const aFull = { A: capacityOfPrefix('A') };
assert.strictEqual(currentPrefixFromOccupancy(REGULAR_FIRST_CHARSET, aFull), 'B');

const zeroFull = { 0: capacityOfPrefix('0') };
assert.strictEqual(currentPrefixFromOccupancy(VIP_FIRST_CHARSET, zeroFull), '1');

const laterTaken = { Z: 12, K: 3 };
assert.strictEqual(
  currentPrefixFromOccupancy(REGULAR_FIRST_CHARSET, laterTaken),
  'A',
  'later prefixes already claimed (old random-first bug) must not skip A'
);

const skip = new Set();
const batch = randomLoginIdBatch({ size: 9, prefix: 'A', skip });
assert.strictEqual(batch.length, 9);
assert.ok(batch.every((id) => id[0] === 'A' && /^[A-Z][A-Z0-9]{3}$/.test(id)));
assert.strictEqual(new Set(batch).size, 9);

const honor = randomLoginIdBatch({ size: 9, prefix: '0', skip: new Set() });
assert.ok(honor.every((id) => id[0] === '0' && /^[0-9][A-Z0-9]{3}$/.test(id)));

console.log('assert-login-id: ok');
