/**
 * 政策提案评估 · 无条件利好判定（纯函数，供测试）
 * @module shared/utils/policyProposalAssessCore
 */

const UNCONDITIONAL_BENEFIT_APPROVAL_BASE = 0.9;

/**
 * @param {number} personalityBase
 * @param {object|null|undefined} assess
 * @param {boolean} kingHonors
 * @returns {{ base: number, boostedUnconditionalBenefit: boolean }}
 */
function applyUnconditionalBenefitApprovalBase(personalityBase, assess, kingHonors) {
  const raw = Number(personalityBase) || 0;
  let base = raw;
  let boosted = false;
  if (
    kingHonors &&
    assess &&
    !assess.hasOngoingReserveLiability &&
    Number(assess.reserveCostSilver) <= 0 &&
    Number(assess.reserveCostFood) <= 0 &&
    assess.factionBenefit === 'positive'
  ) {
    if (base < UNCONDITIONAL_BENEFIT_APPROVAL_BASE) {
      base = UNCONDITIONAL_BENEFIT_APPROVAL_BASE;
      boosted = true;
    }
  }
  if (base < 0) base = 0;
  if (base > 1) base = 1;
  return { base, boostedUnconditionalBenefit: boosted };
}

module.exports = {
  UNCONDITIONAL_BENEFIT_APPROVAL_BASE,
  applyUnconditionalBenefitApprovalBase,
};
