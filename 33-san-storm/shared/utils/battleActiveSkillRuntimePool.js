import { getActiveSkillChargesForMapDimensions } from './tacticalActiveSkillCharges.js';

/**
 * 同一场战斗中，**同一编组将领**（将领1 / 将领2 / 君主）下辖多支我方部队时，
 * 主动技剩余次数（阶段3/4/5）应共用同一计数对象。
 *
 * 池键规则：
 * - 我方 `lineupSlot` 为 `player` | `character1` | `character2` 时，按槽位合并（两支部属同将共享）。
 * - 其余（NPC 等）：优先 `character.id`；否则退回单部队 `troop.id`。
 *
 * @param {object} troop 战场部队对象
 * @returns {string}
 */
export function battleActiveSkillPoolKey(troop) {
  const slot = troop?.lineupSlot;
  if (slot === 'player' || slot === 'character1' || slot === 'character2') {
    return `lineup:${slot}`;
  }
  const cid = troop?.character?.id;
  if (cid != null && String(cid).trim() !== '') {
    return `char:${String(cid)}`;
  }
  const tid = troop?.id;
  if (tid != null && String(tid).trim() !== '') {
    return `troop:${String(tid)}`;
  }
  return 'troop:anon';
}

/**
 * @param {object} troop
 * @param {'_phase3HealRuntime'|'_phase4DamageRuntime'|'_phase5CompositeRuntime'} runtimeProp
 */
export function getSharedActiveSkillRuntimeBag(troop, runtimeProp) {
  return troop?.character?.[runtimeProp] ?? troop?.[runtimeProp];
}

/**
 * @param {object[]} battleTroops
 * @param {number} rows
 * @param {number} cols
 * @param {{ runtimeProp: string, getSlots: (t: object) => object[]|null|undefined }} spec
 */
export function initBattleSharedChargesFromSlots(battleTroops, rows, cols, { runtimeProp, getSlots }) {
  if (!Array.isArray(battleTroops)) return;
  const maxUses = getActiveSkillChargesForMapDimensions(rows, cols);

  /** 同一池内各部队槽位里出现的 skillId 并集（避免「先遍历到的部队槽位较窄」导致后续部队缺键） */
  const skillIdsByPool = new Map();
  for (const t of battleTroops) {
    const slots = getSlots(t);
    if (!slots?.length) continue;
    const key = battleActiveSkillPoolKey(t);
    let set = skillIdsByPool.get(key);
    if (!set) {
      set = new Set();
      skillIdsByPool.set(key, set);
    }
    for (const s of slots) {
      if (s?.skillId) set.add(s.skillId);
    }
  }

  const pools = new Map();
  for (const [key, idSet] of skillIdsByPool) {
    const chargesBySkillId = {};
    for (const skillId of idSet) {
      chargesBySkillId[skillId] = maxUses;
    }
    pools.set(key, { chargesBySkillId });
  }

  for (const t of battleTroops) {
    const slots = getSlots(t);
    if (!slots?.length) {
      delete t[runtimeProp];
      if (t.character) delete t.character[runtimeProp];
      continue;
    }
    const key = battleActiveSkillPoolKey(t);
    const bag = pools.get(key);
    if (!bag) {
      delete t[runtimeProp];
      if (t.character) delete t.character[runtimeProp];
      continue;
    }
    t[runtimeProp] = bag;
    if (t.character) t.character[runtimeProp] = bag;
  }
}
