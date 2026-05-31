/**
 * 势力政策谏言 · 审批预览（客户端兜底）
 *
 * 与 `policyProposalAssessService` + `policyProposalAssessCore.cjs` 语义一致；
 * 当 `POST /faction-policies/preview-approval` 不可用或失败时，Modal 仍可按 draft 展示正确区间。
 *
 * @module utils/policyApprovalPreviewClient
 */

import { POLICY_CATEGORY } from '@/constants/factionPolicyLabels';

const UNCONDITIONAL_BENEFIT_APPROVAL_BASE = 0.9;

/** @param {object|null|undefined} panelApprovalPreview */
function readPersonalityBase(panelApprovalPreview) {
  const p = panelApprovalPreview?.personalityBase ?? panelApprovalPreview?.base;
  return Number.isFinite(Number(p)) ? Number(p) : 0;
}

/**
 * 与后端 `getEffectiveConfigForAssess` 对齐（panel 行 config + lastOutcome）。
 *
 * @param {string} category
 * @param {object|null|undefined} currentConfig
 * @param {string|null|undefined} lastOutcome
 */
function getEffectiveConfigForAssess(category, currentConfig, lastOutcome) {
  if (currentConfig && typeof currentConfig === 'object') {
    if (lastOutcome === 'approved' || lastOutcome === 'rejected') {
      return currentConfig;
    }
  }
  switch (category) {
    case POLICY_CATEGORY.RATION_BONUS:
      return { bonusPct: 0 };
    case POLICY_CATEGORY.SIEGE_REWARD:
      return { personalSharePct: 80 };
    case POLICY_CATEGORY.RECRUIT:
      return { enabled: false };
    case POLICY_CATEGORY.DOMESTIC_GOAL:
      return { goal: null };
    default:
      return {};
  }
}

/**
 * @param {string} category
 * @param {object} draftConfig
 * @param {object} currentEffective
 * @param {{ san0Band?: string|null, openCostSilver?: number }|null|undefined} recruitMapping
 */
function assessLongTermPolicyProposal(category, draftConfig, currentEffective, recruitMapping) {
  let reserveCostSilver = 0;
  const reserveCostFood = 0;
  let hasOngoingReserveLiability = false;
  /** @type {'positive'|'negative'|'neutral'} */
  let factionBenefit = 'neutral';

  switch (category) {
    case POLICY_CATEGORY.RECRUIT: {
      const nextEnabled = !!draftConfig.enabled;
      const prevEnabled = !!currentEffective.enabled;
      if (nextEnabled && !prevEnabled) {
        reserveCostSilver = Math.max(0, Number(recruitMapping?.openCostSilver) || 0);
        factionBenefit = recruitMapping?.san0Band ? 'positive' : 'neutral';
      } else if (!nextEnabled && prevEnabled) {
        factionBenefit = 'negative';
      }
      break;
    }
    case POLICY_CATEGORY.SIEGE_REWARD: {
      const nextPct = Math.round(Number(draftConfig.personalSharePct));
      const prevPct = Math.round(Number(currentEffective.personalSharePct));
      if (nextPct < prevPct) factionBenefit = 'positive';
      else if (nextPct > prevPct) factionBenefit = 'negative';
      break;
    }
    case POLICY_CATEGORY.RATION_BONUS: {
      const nextPct = Math.round(Number(draftConfig.bonusPct));
      const prevPct = Math.round(Number(currentEffective.bonusPct));
      if (nextPct > prevPct) {
        hasOngoingReserveLiability = true;
        factionBenefit = 'negative';
      } else if (nextPct < prevPct) {
        factionBenefit = 'positive';
      }
      break;
    }
    case POLICY_CATEGORY.DOMESTIC_GOAL: {
      const nextGoal = draftConfig.goal ? String(draftConfig.goal) : null;
      const prevGoal = currentEffective.goal ? String(currentEffective.goal) : null;
      if (nextGoal && nextGoal !== prevGoal) factionBenefit = 'positive';
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

function applyUnconditionalBenefitApprovalBase(personalityBase, assess, kingHonors = true) {
  const raw = Number(personalityBase) || 0;
  let base = raw;
  let boostedUnconditionalBenefit = false;
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
      boostedUnconditionalBenefit = true;
    }
  }
  if (base < 0) base = 0;
  if (base > 1) base = 1;
  return { base, boostedUnconditionalBenefit };
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * @param {{
 *   category: string,
 *   draftConfig: object,
 *   currentConfig?: object|null,
 *   lastOutcome?: string|null,
 *   recruitMapping?: { san0Band?: string|null, openCostSilver?: number }|null,
 *   panelApprovalPreview?: object|null,
 *   honorsUnconditionalBenefit?: boolean,
 * }} input
 */
export function computeLocalPolicyApprovalPreview(input) {
  const {
    category,
    draftConfig,
    currentConfig,
    lastOutcome,
    recruitMapping,
    panelApprovalPreview,
    honorsUnconditionalBenefit = true,
  } = input || {};

  const personalityBase = readPersonalityBase(panelApprovalPreview);
  const currentEffective = getEffectiveConfigForAssess(category, currentConfig, lastOutcome);
  const assess = assessLongTermPolicyProposal(
    category,
    draftConfig || {},
    currentEffective,
    recruitMapping,
  );
  const { base, boostedUnconditionalBenefit } = applyUnconditionalBenefitApprovalBase(
    personalityBase,
    assess,
    honorsUnconditionalBenefit,
  );
  const baseClamped = clamp01(base);

  return {
    base: baseClamped,
    personalityBase: clamp01(personalityBase),
    minRate: baseClamped,
    maxRate: clamp01(base * 1.2),
    ...(panelApprovalPreview?.saturated ? { saturated: true } : {}),
    ...(boostedUnconditionalBenefit ? { boostedUnconditionalBenefit: true } : {}),
    benefitAssess: assess,
    note:
      panelApprovalPreview?.note ||
      '实际当次仍先掷骰（×1.0/×1.1/×1.2）再抽检；本范围仅作大致预览，不保证当次必过。',
    previewSource: 'local',
  };
}
