/**
 * Party Pass tier math. No database.
 * Usage: node scripts/assert-party-pass.js
 */

const assert = require('assert');
const {
  effectiveTier,
  upgradeAdjustment,
  tierCode,
  isPass,
} = require('../lib/partyPass');

function purchase(productId, createdAt, state = 'purchased') {
  return { productId, createdAt, state };
}

function testTiers() {
  assert.strictEqual(effectiveTier({ ultra: false, purchases: [] }), 'none');
  assert.strictEqual(
    effectiveTier({ ultra: false, purchases: [purchase('party_pass_99', '2026-01-01')] }),
    '99'
  );
  assert.strictEqual(
    effectiveTier({
      ultra: false,
      purchases: [
        purchase('party_pass_99', '2026-01-01'),
        purchase('party_pass_499', '2026-02-01'),
      ],
    }),
    '499'
  );
  assert.strictEqual(
    effectiveTier({ ultra: true, purchases: [purchase('party_pass_99', '2026-01-01')] }),
    'ultra'
  );
  assert.strictEqual(tierCode('1'), 'none');
  assert.strictEqual(tierCode(''), 'none');
  assert.strictEqual(isPass('99'), true);
  assert.strictEqual(isPass('none'), false);
}

function testUpgrade() {
  const early = purchase('party_pass_99', '2026-01-01T00:00:00Z');
  const later = purchase('party_pass_499', '2026-02-01T00:00:00Z');
  assert.deepStrictEqual(
    upgradeAdjustment({ purchases: [early, later], upgradeOpen: false }),
    { delta: 50, open: true }
  );
  assert.deepStrictEqual(
    upgradeAdjustment({ purchases: [early, later], upgradeOpen: true }),
    { delta: 0, open: true }
  );
  assert.deepStrictEqual(
    upgradeAdjustment({ purchases: [later], upgradeOpen: false }),
    { delta: 0, open: false }
  );
  const boughtHighFirst = purchase('party_pass_499', '2026-01-01T00:00:00Z');
  const boughtBasicAfter = purchase('party_pass_99', '2026-03-01T00:00:00Z');
  assert.deepStrictEqual(
    upgradeAdjustment({
      purchases: [boughtHighFirst, boughtBasicAfter],
      upgradeOpen: false,
    }),
    { delta: 0, open: false }
  );
  assert.deepStrictEqual(
    upgradeAdjustment({ purchases: [early], upgradeOpen: true }),
    { delta: -50, open: false }
  );
  const canceled = purchase('party_pass_499', '2026-02-01T00:00:00Z', 'canceled');
  assert.deepStrictEqual(
    upgradeAdjustment({ purchases: [early, canceled], upgradeOpen: true }),
    { delta: -50, open: false }
  );
}

testTiers();
testUpgrade();
console.log('party pass ok');
