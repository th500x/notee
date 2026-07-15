/**
 * 将领主动 · 阶段5（复合伤害）：`damage_dot` / `damage_debuff` / `damage_heal` / `heal_damage`。
 * 与 `skillPhase4ActiveDamage` 共用形状/锚点/随机池逻辑；`_skillPhase5Composite` + `_phase5CompositeRuntime`。
 * 契约：`docs/20-data-layer/23-SKILL_SYSTEM.md` 阶段5。
 */

import {
  getSharedActiveSkillRuntimeBag,
  initBattleSharedChargesFromSlots,
} from './battleActiveSkillRuntimePool.js';
import { pickPhase4RandomVictims } from './skillPhase4ActiveDamage.js';

const PHASE5_TYPES = new Set(['damage_dot', 'damage_debuff', 'damage_heal', 'heal_damage']);

/**
 * @param {object|null|undefined} skill
 */
export function isActiveSkillPhase5Composite(skill) {
  if (!skill || skill.type !== 'active') return false;
  const ph = Number(skill.implementationPhase);
  if (!Number.isFinite(ph) || ph !== 5) return false;
  const t = String(skill.skillEffectType || '').toLowerCase();
  return PHASE5_TYPES.has(t);
}

/**
 * @param {string|null|undefined} se
 * @returns {{
 *   costSelf: number,
 *   healSelf: number,
 *   healAlly: number,
 *   burn: null | { rounds: number, dotRatio: number },
 *   flatDamage: null | number,
 *   debuffLabel: string | null,
 *   invalid: boolean,
 * }}
 */
export function parsePhase5CompositeSpecialEffect(se) {
  const out = {
    costSelf: 0,
    healSelf: 0,
    healAlly: 0,
    burn: null,
    flatDamage: null,
    debuffLabel: null,
    invalid: false,
  };
  if (se == null || String(se).trim() === '') return out;
  const parts = String(se)
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  for (const p of parts) {
    const idx = p.indexOf(':');
    if (idx <= 0) {
      out.invalid = true;
      return out;
    }
    const key = p.slice(0, idx).trim().toLowerCase();
    const val = p.slice(idx + 1).trim();
    if (key === 'costself') {
      const n = parseInt(val, 10);
      if (!Number.isFinite(n) || n < 0 || n > 50000) {
        out.invalid = true;
        return out;
      }
      out.costSelf += n;
      continue;
    }
    if (key === 'healself') {
      const n = parseInt(val, 10);
      if (!Number.isFinite(n) || n < 0 || n > 50000) {
        out.invalid = true;
        return out;
      }
      out.healSelf = n;
      continue;
    }
    if (key === 'healally') {
      const n = parseInt(val, 10);
      if (!Number.isFinite(n) || n < 0 || n > 50000) {
        out.invalid = true;
        return out;
      }
      out.healAlly = n;
      continue;
    }
    if (key === 'flatdamage') {
      const n = parseInt(val, 10);
      if (!Number.isFinite(n) || n < 0 || n > 50000) {
        out.invalid = true;
        return out;
      }
      out.flatDamage = n;
      continue;
    }
    if (key === 'burn') {
      const bits = val.split(':').map((x) => x.trim());
      const rounds = parseInt(bits[0], 10);
      const dotRatio = parseFloat(bits[1]);
      if (!Number.isFinite(rounds) || rounds < 0 || rounds > 20 || !Number.isFinite(dotRatio) || dotRatio < 0 || dotRatio > 5) {
        out.invalid = true;
        return out;
      }
      out.burn = { rounds, dotRatio };
      continue;
    }
    if (!out.debuffLabel) out.debuffLabel = `${key}:${val}`;
    else out.debuffLabel = `${out.debuffLabel}; ${key}:${val}`;
  }
  return out;
}

/**
 * @param {object} skill
 * @param {string} skillId
 */
export function phase5CompositeSlotFromSkill(skill, skillId) {
  if (!isActiveSkillPhase5Composite(skill)) return null;
  const mult = Number(skill.damageMultiplier);
  if (!Number.isFinite(mult) || mult <= 0) return null;
  const dt = String(skill.damageType || 'physical').toLowerCase();
  if (dt !== 'physical' && dt !== 'strategy') return null;
  const tr = String(skill.targetRange || 'single').toLowerCase();
  const tc = String(skill.targetCount ?? '1');
  const fx = parsePhase5CompositeSpecialEffect(skill.specialEffect);
  if (fx.invalid) return null;
  const eff = String(skill.skillEffectType || '').toLowerCase();

  if (eff === 'damage_dot') {
    if (!fx.burn || fx.burn.dotRatio <= 0) return null;
  } else if (eff === 'damage_debuff') {
    const hasFlat = fx.flatDamage != null && fx.flatDamage > 0;
    const hasDeb = fx.debuffLabel != null && String(fx.debuffLabel).trim() !== '';
    if (!hasFlat && !hasDeb) return null;
  } else if (eff === 'damage_heal') {
    if (fx.healSelf <= 0 && fx.healAlly <= 0) return null;
  } else if (eff === 'heal_damage') {
    if (fx.healSelf <= 0 && fx.healAlly <= 0) return null;
  }

  return {
    skillId,
    name: skill.name || skillId,
    skillEffectType: eff,
    damageMultiplier: mult,
    damageType: dt,
    targetRange: tr,
    targetCount: tc,
    costSelf: fx.costSelf,
    healSelf: fx.healSelf,
    healAlly: fx.healAlly,
    burn: fx.burn,
    flatDamage: fx.flatDamage,
    debuffLabel: fx.debuffLabel,
  };
}

/**
 * @param {string[]} skillIds
 * @param {Record<string, object>} skillsMap
 */
export function buildPhase5CompositeSlotsFromSkillIds(skillIds, skillsMap) {
  const out = [];
  const seen = new Set();
  for (const id of skillIds || []) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const sk = skillsMap[id];
    const slot = phase5CompositeSlotFromSkill(sk, id);
    if (slot) out.push(slot);
  }
  return out;
}

/**
 * @param {object|null|undefined} charLike
 * @param {ReturnType<typeof buildPhase5CompositeSlotsFromSkillIds>} slots
 */
export function attachPhase5CompositeToCharacter(charLike, slots) {
  if (!charLike || typeof charLike !== 'object') return charLike;
  const next = { ...charLike };
  if (!slots || slots.length === 0) {
    delete next._skillPhase5Composite;
    return next;
  }
  next._skillPhase5Composite = { slots: slots.map((s) => ({ ...s })) };
  return next;
}

/** 供治疗段复用：`previewPhase3HealGains` / `applyPhase3HealMutation` */
export function phase5HealSlotStub(slot) {
  return {
    skillId: slot.skillId,
    name: slot.name,
    healSelf: slot.healSelf || 0,
    healAlly: slot.healAlly || 0,
    targetRange: String(slot.targetRange || 'self').toLowerCase(),
  };
}

/**
 * `heal_damage`：施法距离内是否存在可作为随机段的敌军。
 * @param {number} maxCastManhattan 与 `getTacticalActiveSkillCastRange(slot.skillId)` 一致
 */
export function healDamageHasHostileInRange(actor, battleTroops, maxCastManhattan) {
  const rng = Math.max(1, Math.floor(Number(maxCastManhattan)) || 1);
  const pool = pickPhase4RandomVictims(
    actor,
    { targetRange: 'random', targetCount: '1', skillId: '_probe' },
    battleTroops,
    rng,
  );
  return pool.length > 0;
}

export function getRemainingPhase5CompositeCharges(troop, skillId) {
  const m = getSharedActiveSkillRuntimeBag(troop, '_phase5CompositeRuntime')?.chargesBySkillId;
  if (!m || skillId == null) return 0;
  const v = m[skillId];
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

export function consumePhase5CompositeCharge(troop, skillId) {
  const m = getSharedActiveSkillRuntimeBag(troop, '_phase5CompositeRuntime')?.chargesBySkillId;
  if (!m || skillId == null) return false;
  const cur = m[skillId];
  if (!Number.isFinite(cur) || cur <= 0) return false;
  m[skillId] = cur - 1;
  return true;
}

export function initBattlePhase5CompositeRuntime(battleTroops, rows, cols) {
  initBattleSharedChargesFromSlots(battleTroops, rows, cols, {
    runtimeProp: '_phase5CompositeRuntime',
    getSlots: (t) => t.character?._skillPhase5Composite?.slots,
  });
}
