/**
 * 将领残影 Echo · 槽位读写与战斗汇总（21-1 §8.3）
 * @module shared/utils/characterEchoCombat
 */

/** 卡池重复最多写入 2 槽 */
const POOL_ECHO_MAX = 2;

/** 卡面固定三槽（第三槽 M2 才开放写入） */
const ECHO_SLOT_COUNT = 3;

/** 卡池第 1 / 2 槽加成 % */
const POOL_SLOT_PCT = [10, 5];

/** 第三槽规划加成（M1 仅 UI 锁定展示） */
const THIRD_SLOT_PCT = 15;

const SEASON_BADGE_ITEM_ID = 'item_season_badge';

function parseEchoSlots(raw) {
  if (raw == null) return normalizeEchoSlots(null);
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return normalizeEchoSlots(null);
    }
  }
  if (!Array.isArray(parsed)) return normalizeEchoSlots(null);
  return normalizeEchoSlots(parsed);
}

function normalizeEchoSlots(arr) {
  const out = [null, null, null];
  for (let i = 0; i < ECHO_SLOT_COUNT; i += 1) {
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

function countPoolEchoSlots(slots) {
  return parseEchoSlots(slots).filter((s) => s && s.source === 'pool').length;
}

function findNextEmptySlotIndex(slots) {
  const s = parseEchoSlots(slots);
  for (let i = 0; i < POOL_ECHO_MAX; i += 1) {
    if (!s[i]) return i;
  }
  return -1;
}

function getNextPoolEchoPct(slots) {
  const idx = findNextEmptySlotIndex(slots);
  if (idx < 0 || idx >= POOL_SLOT_PCT.length) return null;
  return POOL_SLOT_PCT[idx];
}

function canAddPoolEcho(slots) {
  return countPoolEchoSlots(slots) < POOL_ECHO_MAX;
}

function sumEchoPct(slots, kind) {
  return parseEchoSlots(slots).reduce((sum, slot) => {
    if (!slot || slot.kind !== kind) return sum;
    return sum + (Number(slot.pct) || 0);
  }, 0);
}

function appendPoolEchoSlot(slots, kind) {
  if (kind !== 'attack' && kind !== 'defense') {
    throw new Error('无效的残影方向');
  }
  const s = parseEchoSlots(slots);
  if (!canAddPoolEcho(s)) {
    throw new Error('卡池残影已满');
  }
  const idx = findNextEmptySlotIndex(s);
  const pct = getNextPoolEchoPct(s);
  if (idx < 0 || pct == null) {
    throw new Error('无可用残影槽');
  }
  const next = [...s];
  next[idx] = { kind, pct, source: 'pool' };
  return next;
}

function attachEchoPctToCharacter(charData, slots) {
  if (!charData || typeof charData !== 'object') return charData;
  const attackPct = sumEchoPct(slots, 'attack');
  const defensePct = sumEchoPct(slots, 'defense');
  return {
    ...charData,
    ...(attackPct > 0 ? { characterEchoAttackPct: attackPct } : {}),
    ...(defensePct > 0 ? { characterEchoDefensePct: defensePct } : {}),
  };
}

function buildEchoState(slots) {
  const poolSlotsUsed = countPoolEchoSlots(slots);
  return {
    poolSlotsUsed,
    poolSlotsMax: POOL_ECHO_MAX,
    canAttack: poolSlotsUsed < POOL_ECHO_MAX,
    canDefense: poolSlotsUsed < POOL_ECHO_MAX,
  };
}

function getEchoSlotDisplay(slot, slotIndex) {
  if (slotIndex === 2) {
    return { locked: true, emoji: '🔒', tooltip: '第三残影槽未开放' };
  }
  if (!slot) {
    return { empty: true, emoji: '○', tooltip: '无残影' };
  }
  const ord = slotIndex === 0 ? '第 1 次' : '第 2 次';
  if (slot.kind === 'attack') {
    return { emoji: '⚔️', tooltip: `${ord}强攻 +${slot.pct}%` };
  }
  return { emoji: '🛡️', tooltip: `${ord}坚守 +${slot.pct}%` };
}

module.exports = {
  POOL_ECHO_MAX,
  ECHO_SLOT_COUNT,
  POOL_SLOT_PCT,
  THIRD_SLOT_PCT,
  SEASON_BADGE_ITEM_ID,
  parseEchoSlots,
  normalizeEchoSlots,
  countPoolEchoSlots,
  findNextEmptySlotIndex,
  getNextPoolEchoPct,
  canAddPoolEcho,
  sumEchoPct,
  appendPoolEchoSlot,
  attachEchoPctToCharacter,
  buildEchoState,
  getEchoSlotDisplay,
};
