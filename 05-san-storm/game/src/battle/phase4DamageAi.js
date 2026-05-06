/**
 * 自动战斗 / NPC：阶段4 主动纯伤害（与手动共用 `skillPhase4ActiveDamage` 与 `combatSystem.estimateDamage`）。
 */
import {
  getRemainingPhase4DamageCharges,
  listPhase4AnchorEnemyCandidates,
  listPhase4ShapeVictims,
  pickPhase4RandomVictims,
} from '@shared/utils/skillPhase4ActiveDamage';
import { getMapTerrainDimensions } from '@shared/utils/tacticalBattleGrid';
import { getTacticalActiveSkillCastRange } from '@shared/utils/tacticalSkillCastRange';
import { estimateDamage } from '@/systems/combatSystem';

function phase4StrikeEstimateOptions(slot) {
  const dk = String(slot.damageType || 'physical').toLowerCase() === 'strategy' ? 'strategy' : 'physical';
  const mult = Number(slot.damageMultiplier);
  return {
    strike: 'normal',
    damageKind: dk,
    skillDamageMultiplier: Number.isFinite(mult) && mult > 0 ? mult : 1,
  };
}

function sumPreviewDamage(actor, victims, terrain, battleTroops, slot) {
  const base = { ...phase4StrikeEstimateOptions(slot), battleTroops };
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

/**
 * @param {object} troop
 * @param {object[]} battleTroops
 * @param {object|null} mapResult
 * @returns {{ slot: object, victims: object[] } | null}
 */
export function tryDecidePhase4AiDamage(troop, battleTroops, mapResult) {
  const slots = troop?.character?._skillPhase4Damage?.slots;
  if (!slots?.length || !Array.isArray(battleTroops)) return null;
  const { h: mapH, w: mapW } = getMapTerrainDimensions(mapResult);
  const terrain = mapResult?.terrain ?? null;

  let best = null;
  let bestScore = -1;

  for (const slot of slots) {
    if (getRemainingPhase4DamageCharges(troop, slot.skillId) <= 0) continue;
    if (!aiSafeCostSelf(troop, slot)) continue;
    const cast = getTacticalActiveSkillCastRange(slot.skillId);
    const tr = String(slot.targetRange || '').toLowerCase();
    if (tr === 'random') {
      const victims = pickPhase4RandomVictims(troop, slot, battleTroops, cast);
      if (!victims.length) continue;
      const sum = sumPreviewDamage(troop, victims, terrain, battleTroops, slot);
      if (sum < 35) continue;
      const score = sum * 10 + victims.length;
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
      if (sum < 35) continue;
      const score = sum * 10 + victims.length * 5;
      if (score > bestScore) {
        bestScore = score;
        best = { slot, victims };
      }
    }
  }
  return best;
}
