const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeLegendaryDrawProbabilities,
  computeDailyLegendaryRecovery,
  computePityAfterLegendaryDelivered,
} = require('./factionLegendaryReserve.cjs');

test('computeLegendaryDrawProbabilities scales with quota cap 20', () => {
  assert.equal(computeLegendaryDrawProbabilities(0).legendary, 0);
  assert.equal(computeLegendaryDrawProbabilities(20).legendary, 0.05);
  assert.equal(computeLegendaryDrawProbabilities(99).legendary, 0.05);
  const p10 = computeLegendaryDrawProbabilities(10);
  assert.equal(p10.legendary, 0.025);
  assert.equal(p10.epic, 0.125);
});

test('computeDailyLegendaryRecovery', () => {
  assert.deepEqual(computeDailyLegendaryRecovery(99, 47), { troop: 19, character: 9 });
});

test('computePityAfterLegendaryDelivered overflow', () => {
  assert.equal(computePityAfterLegendaryDelivered(49, 50), 0);
  assert.equal(computePityAfterLegendaryDelivered(51, 50), 1);
});
