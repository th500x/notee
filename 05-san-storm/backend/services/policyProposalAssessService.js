/**
 * 长效政策谏言 · 提案效用评估（41-1 · 无条件利好审批抬升）
 *
 * 与 `passiveApprovalService` 配合：当提案 **零储备扣费** 且 **对势力发展为正** 时，
 * 正常君主可将审批 base 抬升至 0.9（仍掷骰）。
 *
 * @module services/policyProposalAssessService
 */

const defaults = require('./factionPolicyDefaults');
const {
  getEffectiveConfigForAssess: getEffectiveConfigForAssessCore,
} = require('../../shared/utils/factionPolicyEffectiveConfig.cjs');

/** @typedef {'positive'|'negative'|'neutral'} FactionBenefitSign */

const FACTION_BENEFIT = Object.freeze({
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
});

/**
 * @param {object|null|undefined} king
 * @returns {boolean}
 */
function kingHonorsUnconditionalBenefit(king) {
  const traits = king?.approvalTraits;
  if (traits && traits.honorsUnconditionalBenefit === false) return false;
  return true;
}

/**
 * 评估用「当前生效配置」：与 `factionPolicyService.getEffective*` / 朝政面板一致。
 *
 * @param {string} category
 * @param {object|null} existingRow
 * @returns {object}
 */
function getEffectiveConfigForAssess(category, existingRow) {
  return getEffectiveConfigForAssessCore(
    category,
    existingRow,
    defaults.getDefaultConfigForCategory(category),
    {
      rationMinPct: defaults.RATION_BONUS.minPct,
      rationMaxPct: defaults.RATION_BONUS.maxPct,
      siegeDefaultPct: defaults.SIEGE_REWARD.defaultPersonalSharePct,
      domesticGoalOptions: defaults.DOMESTIC_GOAL.options,
    },
  );
}

/**
 * @param {object} assess - {@link assessLongTermPolicyProposal} 返回值
 * @returns {boolean}
 */
function qualifiesUnconditionalBenefit(assess) {
  if (!assess || typeof assess !== 'object') return false;
  if (assess.hasOngoingReserveLiability) return false;
  if (Number(assess.reserveCostSilver) > 0 || Number(assess.reserveCostFood) > 0) return false;
  return assess.factionBenefit === FACTION_BENEFIT.POSITIVE;
}

/**
 * @param {string} factionId
 * @param {string} category - `POLICY_CATEGORIES.*`
 * @param {object} normalizedConfig - 经 `validateConfigForCategory` 规范化
 * @param {object|null} existingRow
 * @returns {{
 *   reserveCostSilver: number,
 *   reserveCostFood: number,
 *   hasOngoingReserveLiability: boolean,
 *   factionBenefit: FactionBenefitSign,
 * }}
 */
function assessLongTermPolicyProposal(factionId, category, normalizedConfig, existingRow) {
  const current = getEffectiveConfigForAssess(category, existingRow);
  let reserveCostSilver = 0;
  const reserveCostFood = 0;
  let hasOngoingReserveLiability = false;
  /** @type {FactionBenefitSign} */
  let factionBenefit = FACTION_BENEFIT.NEUTRAL;

  switch (category) {
    case defaults.POLICY_CATEGORIES.RECRUIT: {
      const nextEnabled = !!normalizedConfig.enabled;
      const prevEnabled = !!current.enabled;
      const mapping = defaults.getRecruitMappingForFaction(factionId);
      if (nextEnabled && !prevEnabled) {
        reserveCostSilver = Math.max(0, Number(mapping.openCostSilver) || 0);
        factionBenefit = mapping.san0Band
          ? FACTION_BENEFIT.POSITIVE
          : FACTION_BENEFIT.NEUTRAL;
      } else if (!nextEnabled && prevEnabled) {
        factionBenefit = FACTION_BENEFIT.NEGATIVE;
      }
      break;
    }
    case defaults.POLICY_CATEGORIES.SIEGE_REWARD: {
      const nextPct = Math.round(Number(normalizedConfig.personalSharePct));
      const prevPct = Math.round(Number(current.personalSharePct));
      if (nextPct < prevPct) factionBenefit = FACTION_BENEFIT.POSITIVE;
      else if (nextPct > prevPct) factionBenefit = FACTION_BENEFIT.NEGATIVE;
      break;
    }
    case defaults.POLICY_CATEGORIES.RATION_BONUS: {
      const nextPct = Math.round(Number(normalizedConfig.bonusPct));
      const prevPct = Math.round(Number(current.bonusPct));
      if (nextPct > prevPct) {
        hasOngoingReserveLiability = true;
        factionBenefit = FACTION_BENEFIT.NEGATIVE;
      } else if (nextPct < prevPct) {
        factionBenefit = FACTION_BENEFIT.POSITIVE;
      }
      break;
    }
    case defaults.POLICY_CATEGORIES.DOMESTIC_GOAL: {
      const nextGoal = normalizedConfig.goal ? String(normalizedConfig.goal) : null;
      const prevGoal = current.goal ? String(current.goal) : null;
      if (nextGoal && nextGoal !== prevGoal) {
        factionBenefit = FACTION_BENEFIT.POSITIVE;
      }
      break;
    }
    default:
      break;
  }

  return {
    reserveCostSilver,
    reserveCostFood,
    hasOngoingReserveLiability,
    factionBenefit,
  };
}

module.exports = {
  FACTION_BENEFIT,
  kingHonorsUnconditionalBenefit,
  assessLongTermPolicyProposal,
  qualifiesUnconditionalBenefit,
  getEffectiveConfigForAssess,
};
