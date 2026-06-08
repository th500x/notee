/**
 * 将领主动 · 阶段3（纯治疗 `heal`）：解析 `special_effect`、装配 `_skillPhase3Heal`、战场 `_phase3HealRuntime`、治疗量结算。
 * 契约：`docs/20-data-layer/23-SKILL_SYSTEM.md` 阶段3；`skill-template.csv` 中 `implementation_phase === 3` 且 `skill_type === heal` 的 **主动** 技能。
 */

import {
  getSharedActiveSkillRuntimeBag,
  initBattleSharedChargesFromSlots,
} from './battleActiveSkillRuntimePool.js';
import { getTacticalActiveSkillCastRange } from './tacticalSkillCastRange.js';

const PHASE3_HEAL_KEYS = new Set(['healself', 'healally']);

/** @deprecated 友军治疗距离已改为按 `slot.skillId` 的施法射程；保留导出以免旧引用断裂 */
export const PHASE3_HEAL_ALLY_MANHATTAN_MAX = 3;

/**
 * @param {string|null|undefined} specialEffect
 * @returns {{ segments: { key: string, value: string }[], invalid: boolean }}
 */
export function parsePhase3HealSpecialEffectSegments(specialEffect) {
  if (specialEffect == null || String(specialEffect).trim() === '') {
    return { segments: [], invalid: false };
  }
  const parts = String(specialEffect)
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  const segments = [];
  for (const p of parts) {
    const idx = p.indexOf(':');
    if (idx <= 0) return { segments: [], invalid: true };
    const key = p.slice(0, idx).trim().toLowerCase();
    const value = p.slice(idx + 1).trim();
    if (!PHASE3_HEAL_KEYS.has(key)) return { segments: [], invalid: true };
    segments.push({ key, value });
  }
  return { segments, invalid: false };
}

/**
 * 主动、效果类型 heal、implementationPhase 3，且 special_effect 每一段均为 healSelf / healAlly 数值。
 */
export function isActiveSkillPhase3PureHeal(skill) {
  if (!skill || skill.type !== 'active' || skill.skillEffectType !== 'heal') return false;
  const ph = Number(skill.implementationPhase);
  if (!Number.isFinite(ph) || ph !== 3) return false;
  const { segments, invalid } = parsePhase3HealSpecialEffectSegments(skill.specialEffect);
  if (invalid || segments.length === 0) return false;
  return true;
}

/**
 * @param {object} skill
 * @returns {{ healSelf: number, healAlly: number } | null}
 */
export function parsePhase3HealAmounts(skill) {
  if (!isActiveSkillPhase3PureHeal(skill)) return null;
  const { segments } = parsePhase3HealSpecialEffectSegments(skill.specialEffect);
  let healSelf = 0;
  let healAlly = 0;
  for (const { key, value } of segments) {
    const n = parseInt(String(value).trim(), 10);
    if (!Number.isFinite(n) || n < 0 || n > 50000) return null;
    if (key === 'healself') healSelf = n;
    if (key === 'healally') healAlly = n;
  }
  if (healSelf <= 0 && healAlly <= 0) return null;
  return { healSelf, healAlly };
}

/**
 * @param {string[]} skillIds
 * @param {Record<string, object>} skillsMap
 * @returns {{ skillId: string, name: string, healSelf: number, healAlly: number, targetRange: string }[]}
 */
export function buildPhase3HealSlotsFromSkillIds(skillIds, skillsMap) {
  const out = [];
  const seen = new Set();
  for (const id of skillIds || []) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const sk = skillsMap[id];
    const amounts = parsePhase3HealAmounts(sk);
    if (!amounts) continue;
    const tr = String(sk.targetRange || 'self').toLowerCase();
    out.push({
      skillId: id,
      name: sk.name || id,
      healSelf: amounts.healSelf,
      healAlly: amounts.healAlly,
      targetRange: tr,
    });
  }
  return out;
}

/**
 * @param {object|null|undefined} charLike
 * @param {{ skillId: string, name: string, healSelf: number, healAlly: number, targetRange: string }[]} slots
 */
export function attachPhase3HealToCharacter(charLike, slots) {
  if (!charLike || typeof charLike !== 'object') return charLike;
  const next = { ...charLike };
  if (!slots || slots.length === 0) {
    delete next._skillPhase3Heal;
    return next;
  }
  next._skillPhase3Heal = { slots: slots.map((s) => ({ ...s })) };
  return next;
}

export function manhattanTroopDist(a, b) {
  if (!a || !b) return Infinity;
  return Math.abs((a.y || 0) - (b.y || 0)) + Math.abs((a.x || 0) - (b.x || 0));
}

/** player / ally 互为友方；enemy 仅与 enemy 互疗 */
export function isSameBattleHealFaction(actor, target) {
  if (!actor || !target) return false;
  const af = actor.faction;
  const bf = target.faction;
  if (af === 'enemy' && bf === 'enemy') return true;
  if ((af === 'player' || af === 'ally') && (bf === 'player' || bf === 'ally')) return true;
  return false;
}

/**
 * @param {object} actor
 * @param {object} target
 * @param {{ healSelf: number, healAlly: number, targetRange: string }} slot
 */
export function isValidPhase3HealTarget(actor, target, slot) {
  if (!actor || !target || target.currentTroops <= 0) return false;
  if (!isSameBattleHealFaction(actor, target)) return false;
  const tr = String(slot?.targetRange || 'self').toLowerCase();
  if (tr === 'self') {
    return target.id === actor.id;
  }
  const d = manhattanTroopDist(actor, target);
  if (tr === 'ally_single') {
    const maxD = getTacticalActiveSkillCastRange(slot?.skillId);
    return d <= maxD;
  }
  return false;
}

/**
 * @param {object} actor
 * @param {object} target 友军单选时的「承受 healAlly 份额」的部队（可与 actor 同格同 id，表示只奶自己）
 * @param {{ healSelf: number, healAlly: number, targetRange: string }} slot
 * @returns {{ selfGain: number, allyGain: number }}
 */
export function previewPhase3HealGains(actor, target, slot) {
  if (!actor || !target || !slot) return { selfGain: 0, allyGain: 0 };
  const maxS = Math.max(0, Math.floor(Number(actor.maxTroops) || 0) - Math.floor(Number(actor.currentTroops) || 0));
  const selfGain = Math.min(Math.max(0, Math.floor(slot.healSelf || 0)), maxS);
  let allyGain = 0;
  if ((slot.healAlly || 0) > 0) {
    const maxT = Math.max(0, Math.floor(Number(target.maxTroops) || 0) - Math.floor(Number(target.currentTroops) || 0));
    allyGain = Math.min(Math.max(0, Math.floor(slot.healAlly || 0)), maxT);
  }
  return { selfGain, allyGain };
}

/**
 * @param {object} actor
 * @param {object} target
 * @param {{ healSelf: number, healAlly: number, targetRange: string }} slot
 * @returns {{ selfGain: number, allyGain: number }}
 */
export function applyPhase3HealMutation(actor, target, slot) {
  const { selfGain, allyGain } = previewPhase3HealGains(actor, target, slot);
  if (selfGain > 0) {
    actor.currentTroops = Math.min(
      Math.floor(Number(actor.maxTroops) || 0),
      Math.floor(Number(actor.currentTroops) || 0) + selfGain,
    );
  }
  if (allyGain > 0) {
    target.currentTroops = Math.min(
      Math.floor(Number(target.maxTroops) || 0),
      Math.floor(Number(target.currentTroops) || 0) + allyGain,
    );
  }
  return { selfGain, allyGain };
}

/**
 * @param {object} actor
 * @param {{ healSelf: number, healAlly: number, targetRange: string }} slot
 * @param {object[]} battleTroops
 * @returns {object[]} 可作为双击目标的友军部队（含自身）
 */
export function listPhase3HealTargetTroops(actor, slot, battleTroops) {
  if (!actor || !slot || !Array.isArray(battleTroops)) return [];
  const out = [];
  for (const t of battleTroops) {
    if (!t || t.currentTroops <= 0) continue;
    if (!isValidPhase3HealTarget(actor, t, slot)) continue;
    const { selfGain, allyGain } = previewPhase3HealGains(actor, t, slot);
    if (selfGain <= 0 && allyGain <= 0) continue;
    out.push(t);
  }
  return out;
}

export function getRemainingPhase3HealCharges(troop, skillId) {
  const m = getSharedActiveSkillRuntimeBag(troop, '_phase3HealRuntime')?.chargesBySkillId;
  if (!m || skillId == null) return 0;
  const v = m[skillId];
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

export function consumePhase3HealCharge(troop, skillId) {
  const m = getSharedActiveSkillRuntimeBag(troop, '_phase3HealRuntime')?.chargesBySkillId;
  if (!m || skillId == null) return false;
  const cur = m[skillId];
  if (!Number.isFinite(cur) || cur <= 0) return false;
  m[skillId] = cur - 1;
  return true;
}

/**
 * @param {object[]} battleTroops
 * @param {number} rows
 * @param {number} cols
 */
export function initBattlePhase3HealRuntime(battleTroops, rows, cols) {
  initBattleSharedChargesFromSlots(battleTroops, rows, cols, {
    runtimeProp: '_phase3HealRuntime',
    getSlots: (t) => t.character?._skillPhase3Heal?.slots,
  });
}
