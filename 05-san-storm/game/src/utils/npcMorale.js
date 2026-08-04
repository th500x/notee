/**
 * NPC / 敌方部队初始士气：与玩家将领卡牌、rewardService 发卡逻辑一致。
 * 最终士气 = 基础士气（关卡可由管理员配置；小型战斗默认 70）+ 将领 `trait_modifier` × 2（配置表「修正值」，见 17-1 / 21 性格表）
 */

export const NPC_DEFAULT_BASE_MORALE = 70;

/**
 * @param {object|null|undefined} char - 将领配置（含 traitModifier / trait_modifier）
 * @param {number} [configuredBaseMorale=NPC_DEFAULT_BASE_MORALE] - 关卡等单位配置的基础士气；事件/小型战斗用默认 70
 * @returns {number} 0..120
 */
export function initialMoraleFromCharacter(char, configuredBaseMorale = NPC_DEFAULT_BASE_MORALE) {
  const base = Number(configuredBaseMorale);
  const safeBase = Number.isFinite(base) ? base : NPC_DEFAULT_BASE_MORALE;
  const trait = char ? Number(char.traitModifier ?? char.trait_modifier ?? 0) : 0;
  return Math.max(0, Math.min(120, safeBase + trait * 2));
}
