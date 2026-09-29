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
  assertRegularLoginId,
  assertLionLoginId,
} = require('../lib/loginId');
const {
  LION_LOGIN_IDS,
  BLOCKED_LOGIN_IDS,
  RESERVED_LOGIN_IDS,
  isLionLoginId,
  isReservedLoginId,
} = require('../lib/reservedLoginIds');

assert.strictEqual(PREFIX_CAPACITY, 36 ** 3);

assert.strictEqual(LION_LOGIN_IDS.size, 36);
assert.strictEqual(RESERVED_LOGIN_IDS.size, BLOCKED_LOGIN_IDS.size + 36);
assert.ok(isLionLoginId('AAAA') && isLionLoginId('0000') && isLionLoginId('ZZZZ') && isLionLoginId('9999'));
assert.ok(!isLionLoginId('AAAB') && !isLionLoginId('0011'));
assert.ok(isReservedLoginId('AAAA') && isReservedLoginId('NOTE'));
assert.ok(!isLionLoginId('NOTE'));

function reservedCount(prefix) {
  return [...RESERVED_LOGIN_IDS].filter((id) => id[0] === prefix).length;
}
assert.strictEqual(capacityOfPrefix('A'), PREFIX_CAPACITY - reservedCount('A'));
assert.strictEqual(capacityOfPrefix('0'), PREFIX_CAPACITY - reservedCount('0'));

assert.throws(() => assertRegularLoginId('AAAA'), (err) => err.code === 'RESERVED_LOGIN_ID');
assert.throws(() => assertRegularLoginId('0000'), (err) => err.code === 'BAD_LOGIN_ID');
assert.strictEqual(assertLionLoginId('aaaa'), 'AAAA');
assert.throws(() => assertLionLoginId('AB12'), (err) => err.code === 'NOT_LION_LOGIN_ID');

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
assert.ok(!batch.includes('AAAA'));

const manyA = randomLoginIdBatch({ size: 200, prefix: 'A', skip: new Set() });
assert.ok(!manyA.includes('AAAA'));
const many0 = randomLoginIdBatch({ size: 200, prefix: '0', skip: new Set() });
assert.ok(!many0.includes('0000'));

const honor = randomLoginIdBatch({ size: 9, prefix: '0', skip: new Set() });
assert.ok(honor.every((id) => id[0] === '0' && /^[0-9][A-Z0-9]{3}$/.test(id)));

console.log('assert-login-id: ok');
