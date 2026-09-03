/**
 * 自动战斗 / NPC：阶段3 纯治疗主动技决策（与手动共用 `skillPhase3ActiveHeal` 规则）。
 */
import {
  getRemainingPhase3HealCharges,
  listPhase3HealTargetTroops,
  previewPhase3HealGains,
} from '@shared/utils/skillPhase3ActiveHeal';

/**
 * @param {object} troop 当前行动部队
 * @param {object[]} battleTroops
 * @returns {{ slot: object, target: object } | null}
 */
export function tryDecidePhase3AiHeal(troop, battleTroops) {
  const slots = troop?.character?._skillPhase3Heal?.slots;
  if (!slots?.length || !Array.isArray(battleTroops)) return null;

  let best = null;
  let bestScore = -1;

  for (const slot of slots) {
    if (getRemainingPhase3HealCharges(troop, slot.skillId) <= 0) continue;
    const candidates = listPhase3HealTargetTroops(troop, slot, battleTroops);
    for (const target of candidates) {
      const { selfGain, allyGain } = previewPhase3HealGains(troop, target, slot);
      const total = selfGain + allyGain;
      if (total <= 0) continue;
      const score = total * 100 + (target !== troop ? 1 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = { slot, target };
      }
    }
  }
  if (!best) return null;
  const { selfGain, allyGain } = previewPhase3HealGains(troop, best.target, best.slot);
  if (selfGain + allyGain < 40) return null;
  return best;
}
