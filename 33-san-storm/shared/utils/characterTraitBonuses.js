/**
 * 将领性格对战术战斗的加成（与 docs 10-core-system/17-1 性格表一致）。
 * 士气「修正值×2」由配置 `trait_modifier` 与 `initialMoraleFromCharacter` 处理，本模块只管普攻/公式线伤害与无惧的承伤侧防御。
 */

/** @param {string|undefined|null} trait */
function normTrait(trait) {
  if (trait == null || trait === '') return '';
  return String(trait).trim().toLowerCase();
}

/** 攻击方性格：总伤害乘子（在士气攻击系数之后叠乘） */
const TRAIT_OUTGOING_DAMAGE_MULT = {
  brave: 1.06,
  reckless: 1.08,
  calm: 1.02,
  normal: 1,
  cautious: 0.98,
  timid: 0.94,
};

/** 防守方性格：防御强度乘子（作用于 `singleDef` 合成前的将领+部队防御项） */
const TRAIT_DEFENDER_DEFENSE_STRENGTH_MULT = {
  reckless: 0.98,
};

/**
 * @param {object|null|undefined} character - 含 `trait`（camelCase 或来自 JSON）
 * @returns {number}
 */
export function getTraitOutgoingDamageMult(character) {
  const k = normTrait(character?.trait);
  if (!k) return 1;
  const m = TRAIT_OUTGOING_DAMAGE_MULT[k];
  return typeof m === 'number' && m > 0 ? m : 1;
}

/**
 * @param {object|null|undefined} character
 * @returns {number}
 */
export function getTraitDefenderDefenseStrengthMult(character) {
  const k = normTrait(character?.trait);
  if (!k) return 1;
  const m = TRAIT_DEFENDER_DEFENSE_STRENGTH_MULT[k];
  return typeof m === 'number' && m > 0 ? m : 1;
}
