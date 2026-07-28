/**
 * node shared/utils/eventOptionRewards.test.cjs
 */
const assert = require('assert');
const { resolveEventOptionRewardStrings } = require('./eventOptionRewards.cjs');

{
  const r = resolveEventOptionRewardStrings({ rewards: 'reward-b', bonusRewards: 'reward-a' });
  assert.strictEqual(r.rewards, 'reward-b');
  assert.strictEqual(r.bonusRewards, 'reward-a');
  assert.strictEqual(r.promotedBonusToBase, false);
}
{
  const r = resolveEventOptionRewardStrings({ rewards: null, bonusRewards: 'reward-a' });
  assert.strictEqual(r.rewards, 'reward-a');
  assert.strictEqual(r.bonusRewards, '');
  assert.strictEqual(r.promotedBonusToBase, true);
}
{
  const r = resolveEventOptionRewardStrings({ rewards: '', bonusRewards: 'pack-b;reward-a' });
  assert.strictEqual(r.rewards, 'pack-b;reward-a');
  assert.strictEqual(r.bonusRewards, '');
}
{
  const r = resolveEventOptionRewardStrings({});
  assert.strictEqual(r.rewards, '');
  assert.strictEqual(r.bonusRewards, '');
}

console.log('eventOptionRewards.test.cjs: ok');
