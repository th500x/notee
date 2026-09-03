/**
 * AI 君主性格饱和调制 *_eff 推导（M2 直接实装）
 *
 * 与 41-AI_KING_SYSTEM.md §「野心（ambition）与中后期调制」严格一致：
 *   - cityCountSaturation = ambition × 100
 *   - 未饱和（cityCount < cityCountSaturation）：*_eff = 性格原值
 *   - 已饱和：*_eff = clamp(personality.X × saturationModifiers.XFactor, 0, 1)
 *
 * 同一组 *_eff 同时被「被动审批」（passiveApprovalService）与「主动决策」
 * （aiKingActiveDecisionService）消费，避免两边对饱和态做不同推导。
 *
 * 纯函数：不读库、不写日志；调用方负责传入当前 `cityCount`（一次 SQL 计算后注入）。
 *
 * @module backend/utils/aiKingPersonalityEff
 */

/** 性格五维中参与饱和调制 / 决策权重的四维（ambition 自身仅作阈值，不参与调制） */
const PERSONALITY_DIMENSIONS_FOR_EFF = Object.freeze([
  'aggression',
  'caution',
  'evolution',
  'excitation',
]);

/** 「ambition × 100 = 饱和所需城数」的常量乘数；与 41 设定一致。 */
const AMBITION_TO_SATURATION_CITY_COUNT = 100;

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * 由 ambition 推导饱和阈值（取整向上 / 向下与文档约定一致：文档为线性映射；
 * 这里取 `Math.round` 给整数城数，方便与 cities 表 COUNT(*) 直接比较）。
 *
 * @param {number} ambition - 0..1
 * @returns {number} 进入饱和态所需占有城池数
 */
function cityCountSaturationFromAmbition(ambition) {
  const a = clamp01(Number(ambition));
  return Math.round(a * AMBITION_TO_SATURATION_CITY_COUNT);
}

/**
 * 计算 *_eff（饱和调制后的有效性格）。
 *
 * @param {object} king - 来自 aiKingConfigService 的君主对象
 * @param {object} king.personality - { aggression, caution, evolution, excitation, ambition }
 * @param {object} [king.ambitionThreshold] - { saturationModifiers: { aggressionFactor, ... } }
 * @param {number} cityCount - 当前势力占有城数（用于判定是否进入饱和态）
 * @returns {{
 *   aggressionEff: number, cautionEff: number, evolutionEff: number, excitationEff: number,
 *   saturated: boolean, cityCountSaturation: number,
 *   ambition: number,
 * }}
 */
function computeSaturatedPersonality(king, cityCount) {
  if (!king || !king.personality) {
    throw new Error('[aiKingPersonalityEff] king.personality 缺失');
  }
  const p = king.personality;
  const ambition = clamp01(Number(p.ambition));
  const saturationCityCount = cityCountSaturationFromAmbition(ambition);
  const cc = Math.max(0, Math.floor(Number(cityCount) || 0));
  const saturated = cc >= saturationCityCount && saturationCityCount > 0;

  // saturationModifiers 缺省 → 等价不调制（factor = 1）
  const mods = king.ambitionThreshold?.saturationModifiers || {};
  const factorOf = (dim) => {
    const v = Number(mods[`${dim}Factor`]);
    return Number.isFinite(v) ? v : 1;
  };

  const eff = {};
  for (const dim of PERSONALITY_DIMENSIONS_FOR_EFF) {
    const base = clamp01(Number(p[dim]));
    eff[`${dim}Eff`] = saturated ? clamp01(base * factorOf(dim)) : base;
  }

  return {
    ...eff,
    saturated,
    cityCountSaturation: saturationCityCount,
    ambition,
  };
}

/**
 * 取与 `proposalType` 对应的 *_eff（与 PROPOSAL_TYPE_TO_PERSONALITY_KEY 同语义）：
 *   - `'war'` → aggressionEff
 *   - `'policy'` → evolutionEff
 *
 * @param {ReturnType<typeof computeSaturatedPersonality>} effObj
 * @param {'war'|'policy'} proposalType
 * @returns {number}
 */
function pickEffByProposalType(effObj, proposalType) {
  if (proposalType === 'war') return effObj.aggressionEff;
  if (proposalType === 'policy') return effObj.evolutionEff;
  throw new Error(`[aiKingPersonalityEff] 未知 proposalType: ${proposalType}`);
}

module.exports = {
  computeSaturatedPersonality,
  cityCountSaturationFromAmbition,
  pickEffByProposalType,
  clamp01,
  PERSONALITY_DIMENSIONS_FOR_EFF,
  AMBITION_TO_SATURATION_CITY_COUNT,
};
