/**
 * 自动战斗 / NPC：阶段5 复合主动（与手动共用 `skillPhase5CompositeDamage` + `performPhase5Composite`）。
 */
import {
  getRemainingPhase5CompositeCharges,
  healDamageHasHostileInRange,
  phase5HealSlotStub,
} from '@shared/utils/skillPhase5CompositeDamage';
import {
  listPhase4AnchorEnemyCandidates,
  listPhase4ShapeVictims,
  pickPhase4RandomVictims,
} from '@shared/utils/skillPhase4ActiveDamage';
import { getMapTerrainDimensions } from '@shared/utils/tacticalBattleGrid';
import { getTacticalActiveSkillCastRange } from '@shared/utils/tacticalSkillCastRange';
import { estimateDamage } from '@/systems/combatSystem';
import { previewPhase3HealGains } from '@shared/utils/skillPhase3ActiveHeal';

function phase5StrikeEstimateOptions(slot) {
  const dk = String(slot.damageType || 'physical').toLowerCase() === 'strategy' ? 'strategy' : 'physical';
  const mult = Number(slot.damageMultiplier);
  return {
    strike: 'normal',
    damageKind: dk,
    skillDamageMultiplier: Number.isFinite(mult) && mult > 0 ? mult : 1,
  };
}

function sumPreviewDamage(actor, victims, terrain, battleTroops, slot) {
  const base = { ...phase5StrikeEstimateOptions(slot), battleTroops };
  let s = 0;
  for (const v of victims) {
    if (!v || v.currentTroops <= 0) continue;
    s += estimateDamage(actor, v, terrain, base).damage;
  }
  return s;
}

function aiSafeCostSelf(actor, slot) {
  const c = Math.max(0, Math.floor(Number(slot.costSelf) || 0));
  if (c <= 0) return true;
  const cur = Math.floor(Number(actor.currentTroops) || 0);
  return cur > c + 20;
}

function burnPreviewSum(victims, burn) {
  if (!burn || burn.dotRatio <= 0 || burn.rounds <= 0) return 0;
  let s = 0;
  for (const v of victims) {
    if (!v || v.currentTroops <= 0) continue;
    let cur = v.currentTroops;
    for (let r = 0; r < burn.rounds; r++) {
      const tick = Math.min(cur, Math.floor(cur * burn.dotRatio));
      s += tick;
      cur -= tick;
      if (cur <= 0) break;
    }
  }
  return s;
}

function flatPreviewSum(victims, flatDamage) {
  const fd = flatDamage != null ? Math.max(0, Math.floor(Number(flatDamage))) : 0;
  if (fd <= 0) return 0;
  let s = 0;
  for (const v of victims) {
    if (!v || v.currentTroops <= 0) continue;
    s += Math.min(v.currentTroops, fd);
  }
  return s;
}

/**
 * @param {object} troop
 * @param {object[]} battleTroops
 * @param {object|null} mapResult
 * @returns {{ slot: object, victims: object[] } | null}
 */
export function tryDecidePhase5AiComposite(troop, battleTroops, mapResult) {
  const slots = troop?.character?._skillPhase5Composite?.slots;
  if (!slots?.length || !Array.isArray(battleTroops)) return null;
  const { h: mapH, w: mapW } = getMapTerrainDimensions(mapResult);
  const terrain = mapResult?.terrain ?? null;

  let best = null;
  let bestScore = -1;

  for (const slot of slots) {
    if (getRemainingPhase5CompositeCharges(troop, slot.skillId) <= 0) continue;
    if (!aiSafeCostSelf(troop, slot)) continue;
    const eff = String(slot.skillEffectType || '').toLowerCase();
    const cast = getTacticalActiveSkillCastRange(slot.skillId);

    if (eff === 'heal_damage') {
      const stub = phase5HealSlotStub(slot);
      const { selfGain, allyGain } = previewPhase3HealGains(troop, troop, stub);
      if (selfGain + allyGain < 1) continue;
      if (!healDamageHasHostileInRange(troop, battleTroops, cast)) continue;
      const strikeList = pickPhase4RandomVictims(
        troop,
        { targetRange: 'random', targetCount: '1', skillId: slot.skillId },
        battleTroops,
        cast,
      );
      const est =
        strikeList.length > 0
          ? estimateDamage(troop, strikeList[0], terrain, { ...phase5StrikeEstimateOptions(slot), battleTroops }).damage
          : 0;
      const score = (selfGain + allyGain) * 5 + est;
      if (score >= 40 && score > bestScore) {
        bestScore = score;
        best = { slot, victims: [] };
      }
      continue;
    }

    const tr = String(slot.targetRange || '').toLowerCase();
    if (tr === 'random') {
      const victims = pickPhase4RandomVictims(troop, slot, battleTroops, cast);
      if (!victims.length) continue;
      const sum = sumPreviewDamage(troop, victims, terrain, battleTroops, slot);
      let extra = 0;
      if (eff === 'damage_dot') extra = burnPreviewSum(victims, slot.burn);
      if (eff === 'damage_debuff') extra = flatPreviewSum(victims, slot.flatDamage);
      if (sum + extra < 35) continue;
      const score = (sum + extra) * 10 + victims.length;
      if (score > bestScore) {
        bestScore = score;
        best = { slot, victims };
      }
      continue;
    }
    const anchors = listPhase4AnchorEnemyCandidates(troop, slot, battleTroops, mapH, mapW, cast);
    for (const anchor of anchors) {
      const victims = listPhase4ShapeVictims(troop, anchor, slot, battleTroops, mapH, mapW);
      if (!victims.length) continue;
      const sum = sumPreviewDamage(troop, victims, terrain, battleTroops, slot);
      let extra = 0;
      if (eff === 'damage_dot') extra = burnPreviewSum(victims, slot.burn);
      if (eff === 'damage_debuff') extra = flatPreviewSum(victims, slot.flatDamage);
      if (sum + extra < 35) continue;
      const score = (sum + extra) * 10 + victims.length * 5;
      if (score > bestScore) {
        bestScore = score;
        best = { slot, victims };
      }
    }
  }

  if (best) return best;
  return null;
}
