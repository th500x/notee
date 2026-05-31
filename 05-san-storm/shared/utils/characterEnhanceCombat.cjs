/**
 * 将领重复增强 · 槽位读写与战斗汇总（21-1 §8.3）
 * @module shared/utils/characterEnhanceCombat
 */

/** 卡池重复最多写入 2 槽 */
const POOL_ENHANCE_MAX = 2;

/** 卡面固定三槽（第三槽 M2 才开放写入） */
const ENHANCE_SLOT_COUNT = 3;

/** 卡池第 1 / 2 槽加成 % */
const POOL_SLOT_PCT = [10, 5];

/** 第三槽规划加成（M1 仅 UI 锁定展示） */
const THIRD_SLOT_PCT = 15;

const SEASON_BADGE_ITEM_ID = 'item_season_badge';

function parseEnhanceSlots(raw) {
  if (raw == null) return normalizeEnhanceSlots(null);
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return normalizeEnhanceSlots(null);
    }
  }
  if (!Array.isArray(parsed)) return normalizeEnhanceSlots(null);
  return normalizeEnhanceSlots(parsed);
}

function normalizeEnhanceSlots(arr) {
  const out = [null, null, null];
  for (let i = 0; i < ENHANCE_SLOT_COUNT; i += 1) {
    const slot = arr?.[i];
    if (!slot || typeof slot !== 'object') continue;
    const kind = slot.kind === 'defense' ? 'defense' : slot.kind === 'attack' ? 'attack' : null;
    if (!kind) continue;
    out[i] = {
      kind,
      pct: Number(slot.pct) || 0,
      source: slot.source || 'pool',
    };
  }
  return out;
}

function countPoolEnhanceSlots(slots) {
  return parseEnhanceSlots(slots).filter((s) => s && s.source === 'pool').length;
}

function findNextEmptySlotIndex(slots) {
  const s = parseEnhanceSlots(slots);
  for (let i = 0; i < POOL_ENHANCE_MAX; i += 1) {
    if (!s[i]) return i;
  }
  return -1;
}

function getNextPoolEnhancePct(slots) {
  const idx = findNextEmptySlotIndex(slots);
  if (idx < 0 || idx >= POOL_SLOT_PCT.length) return null;
  return POOL_SLOT_PCT[idx];
}

function canAddPoolEnhance(slots) {
  return countPoolEnhanceSlots(slots) < POOL_ENHANCE_MAX;
}

function sumEnhancePct(slots, kind) {
  return parseEnhanceSlots(slots).reduce((sum, slot) => {
    if (!slot || slot.kind !== kind) return sum;
    return sum + (Number(slot.pct) || 0);
  }, 0);
}

function appendPoolEnhanceSlot(slots, kind) {
  if (kind !== 'attack' && kind !== 'defense') {
    throw new Error('无效的增强方向');
  }
  const s = parseEnhanceSlots(slots);
  if (!canAddPoolEnhance(s)) {
    throw new Error('卡池增强已满');
  }
  const idx = findNextEmptySlotIndex(s);
  const pct = getNextPoolEnhancePct(s);
  if (idx < 0 || pct == null) {
    throw new Error('无可用增强槽');
  }
  const next = [...s];
  next[idx] = { kind, pct, source: 'pool' };
  return next;
}

function attachEnhancePctToCharacter(charData, slots) {
  if (!charData || typeof charData !== 'object') return charData;
  const attackPct = sumEnhancePct(slots, 'attack');
  const defensePct = sumEnhancePct(slots, 'defense');
  return {
    ...charData,
    ...(attackPct > 0 ? { characterEnhanceAttackPct: attackPct } : {}),
    ...(defensePct > 0 ? { characterEnhanceDefensePct: defensePct } : {}),
  };
}

function buildDuplicateEnhanceState(slots) {
  const poolSlotsUsed = countPoolEnhanceSlots(slots);
  return {
    poolSlotsUsed,
    poolSlotsMax: POOL_ENHANCE_MAX,
    canAttack: poolSlotsUsed < POOL_ENHANCE_MAX,
    canDefense: poolSlotsUsed < POOL_ENHANCE_MAX,
  };
}

function getEnhanceSlotDisplay(slot, slotIndex) {
  if (slotIndex === 2) {
    return { locked: true, emoji: '🔒', tooltip: '第三增强未开放' };
  }
  if (!slot) {
    return { empty: true, emoji: '○', tooltip: '未增强' };
  }
  const ord = slotIndex === 0 ? '第 1 次' : '第 2 次';
  if (slot.kind === 'attack') {
    return { emoji: '⚔️', tooltip: `${ord}强攻 +${slot.pct}%` };
  }
  return { emoji: '🛡️', tooltip: `${ord}坚守 +${slot.pct}%` };
}

module.exports = {
  POOL_ENHANCE_MAX,
  ENHANCE_SLOT_COUNT,
  POOL_SLOT_PCT,
  THIRD_SLOT_PCT,
  SEASON_BADGE_ITEM_ID,
  parseEnhanceSlots,
  normalizeEnhanceSlots,
  countPoolEnhanceSlots,
  findNextEmptySlotIndex,
  getNextPoolEnhancePct,
  canAddPoolEnhance,
  sumEnhancePct,
  appendPoolEnhanceSlot,
  attachEnhancePctToCharacter,
  buildDuplicateEnhanceState,
  getEnhanceSlotDisplay,
};
