const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./policyProposalAssessCore.cjs');

test('applyUnconditionalBenefitApprovalBase: positive free → floor 0.9', () => {
  const r = core.applyUnconditionalBenefitApprovalBase(0.2, {
    reserveCostSilver: 0,
    reserveCostFood: 0,
    hasOngoingReserveLiability: false,
    factionBenefit: 'positive',
  }, true);
  assert.equal(r.base, 0.9);
  assert.equal(r.boostedUnconditionalBenefit, true);
});

test('applyUnconditionalBenefitApprovalBase: reserve cost blocks boost', () => {
  const r = core.applyUnconditionalBenefitApprovalBase(0.2, {
    reserveCostSilver: 2000,
    reserveCostFood: 0,
    hasOngoingReserveLiability: false,
    factionBenefit: 'positive',
  }, true);
  assert.equal(r.base, 0.2);
  assert.equal(r.boostedUnconditionalBenefit, false);
});

test('applyUnconditionalBenefitApprovalBase: tyrant king skips boost', () => {
  const r = core.applyUnconditionalBenefitApprovalBase(0.2, {
    reserveCostSilver: 0,
    reserveCostFood: 0,
    hasOngoingReserveLiability: false,
    factionBenefit: 'positive',
  }, false);
  assert.equal(r.base, 0.2);
  assert.equal(r.boostedUnconditionalBenefit, false);
});

test('applyUnconditionalBenefitApprovalBase: already high base unchanged', () => {
  const r = core.applyUnconditionalBenefitApprovalBase(0.95, {
    reserveCostSilver: 0,
    reserveCostFood: 0,
    hasOngoingReserveLiability: false,
    factionBenefit: 'positive',
  }, true);
  assert.equal(r.base, 0.95);
  assert.equal(r.boostedUnconditionalBenefit, false);
});
