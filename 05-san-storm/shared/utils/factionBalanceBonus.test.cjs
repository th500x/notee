const assert = require('assert');
const {
  computeFactionBalanceBonusSilver,
  clampCreationWizardSilver,
  FACTION_BALANCE_BONUS_MAX,
} = require('./factionBalanceBonus.cjs');

assert.strictEqual(computeFactionBalanceBonusSilver(0, 30), 30);
assert.strictEqual(computeFactionBalanceBonusSilver(1, 30), 20);
assert.strictEqual(computeFactionBalanceBonusSilver(10, 30), 20);
assert.strictEqual(computeFactionBalanceBonusSilver(30, 30), 0);
assert.strictEqual(computeFactionBalanceBonusSilver(0, 500), FACTION_BALANCE_BONUS_MAX);
assert.strictEqual(computeFactionBalanceBonusSilver(5, 15), 10);
assert.strictEqual(clampCreationWizardSilver(50), 50);
assert.strictEqual(clampCreationWizardSilver(999), 50);
assert.strictEqual(clampCreationWizardSilver(-5), 0);

console.log('factionBalanceBonus tests ok');
