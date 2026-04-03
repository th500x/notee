/**
 * NPC / 敌方部队初始士气：与玩家将领卡牌、rewardService 发卡逻辑一致。
 * 最终士气 = 基础士气（战役可由管理员配置；小型战斗默认 70）+ 将领 trait_modifier（配置表）
 */

export const NPC_DEFAULT_BASE_MORALE = 70;

/**
 * @param {object|null|undefined} char - 将领配置（含 traitModifier / trait_modifier）
 * @param {number} [campaignBaseMorale=NPC_DEFAULT_BASE_MORALE] - 战役等单位配置的基础士气；事件/小型战斗用默认 70
 * @returns {number} 0..120
 */
export function initialMoraleFromCharacter(char, campaignBaseMorale = NPC_DEFAULT_BASE_MORALE) {
  const base = Number(campaignBaseMorale);
  const safeBase = Number.isFinite(base) ? base : NPC_DEFAULT_BASE_MORALE;
  const trait = char ? Number(char.traitModifier ?? char.trait_modifier ?? 0) : 0;
  return Math.max(0, Math.min(120, safeBase + trait));
}
