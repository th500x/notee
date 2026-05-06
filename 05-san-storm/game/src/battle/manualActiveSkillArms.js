/**
 * 手动战斗：阶段5 复合 + 阶段4 纯伤 + 阶段3 治疗「武装槽」列表（与 `useManualBattle` / `skillPhase*` 一致）。
 */

import {
  listPhase3HealTargetTroops,
  getRemainingPhase3HealCharges,
  previewPhase3HealGains,
} from '@shared/utils/skillPhase3ActiveHeal';
import {
  getRemainingPhase4DamageCharges,
  listPhase4AnchorEnemyCandidates,
} from '@shared/utils/skillPhase4ActiveDamage';
import {
  getRemainingPhase5CompositeCharges,
  healDamageHasHostileInRange,
  phase5HealSlotStub,
} from '@shared/utils/skillPhase5CompositeDamage';
import { getTacticalActiveSkillCastRange } from '@shared/utils/tacticalSkillCastRange';

/**
 * @returns {{ kind: 'phase5' | 'phase4' | 'phase3', slot: object }[]}
 */
export function buildManualActiveSkillArms(troop) {
  const arms = [];
  const p5 = troop?.character?._skillPhase5Composite?.slots;
  if (Array.isArray(p5)) {
    for (const slot of p5) {
      if (slot && slot.skillId) arms.push({ kind: 'phase5', slot });
    }
  }
  const p4 = troop?.character?._skillPhase4Damage?.slots;
  if (Array.isArray(p4)) {
    for (const slot of p4) {
      if (slot && slot.skillId) arms.push({ kind: 'phase4', slot });
    }
  }
  const p3 = troop?.character?._skillPhase3Heal?.slots;
  if (Array.isArray(p3)) {
    for (const slot of p3) {
      if (slot && slot.skillId) arms.push({ kind: 'phase3', slot });
    }
  }
  return arms;
}

/**
 * @param {{ kind: 'phase5' | 'phase4' | 'phase3', slot: object }} arm
 */
export function activeSkillArmCharges(troop, arm) {
  if (!arm?.slot?.skillId) return 0;
  if (arm.kind === 'phase5') return getRemainingPhase5CompositeCharges(troop, arm.slot.skillId);
  if (arm.kind === 'phase4') return getRemainingPhase4DamageCharges(troop, arm.slot.skillId);
  return getRemainingPhase3HealCharges(troop, arm.slot.skillId);
}

/**
 * @param {number} mapH
 * @param {number} mapW
 */
export function armHasActionableTargets(troop, arm, battleTroops, mapH, mapW) {
  if (!arm?.slot) return false;
  if (arm.kind === 'phase3') {
    return listPhase3HealTargetTroops(troop, arm.slot, battleTroops).length > 0;
  }
  const cast = getTacticalActiveSkillCastRange(arm.slot.skillId);
  if (arm.kind === 'phase4') {
    return listPhase4AnchorEnemyCandidates(troop, arm.slot, battleTroops, mapH, mapW, cast).length > 0;
  }
  if (arm.kind === 'phase5') {
    const slot = arm.slot;
    const eff = String(slot.skillEffectType || '').toLowerCase();
    if (eff === 'heal_damage') {
      const stub = phase5HealSlotStub(slot);
      const { selfGain, allyGain } = previewPhase3HealGains(troop, troop, stub);
      if (selfGain + allyGain <= 0) return false;
      return healDamageHasHostileInRange(troop, battleTroops, cast);
    }
    return listPhase4AnchorEnemyCandidates(troop, slot, battleTroops, mapH, mapW, cast).length > 0;
  }
  return false;
}
