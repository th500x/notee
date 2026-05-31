const assert = require('assert');
const {
  parseEnhanceSlots,
  countPoolEnhanceSlots,
  canAddPoolEnhance,
  appendPoolEnhanceSlot,
  sumEnhancePct,
  attachEnhancePctToCharacter,
  buildDuplicateEnhanceState,
  getNextPoolEnhancePct,
} = require('./characterEnhanceCombat.cjs');

const empty = parseEnhanceSlots(null);
assert.deepStrictEqual(empty, [null, null, null]);
assert.strictEqual(countPoolEnhanceSlots(empty), 0);
assert.strictEqual(canAddPoolEnhance(empty), true);
assert.strictEqual(getNextPoolEnhancePct(empty), 10);

let slots = appendPoolEnhanceSlot(empty, 'attack');
assert.strictEqual(slots[0].kind, 'attack');
assert.strictEqual(slots[0].pct, 10);
assert.strictEqual(slots[0].source, 'pool');
assert.strictEqual(sumEnhancePct(slots, 'attack'), 10);
assert.strictEqual(sumEnhancePct(slots, 'defense'), 0);

slots = appendPoolEnhanceSlot(slots, 'defense');
assert.strictEqual(slots[1].pct, 5);
assert.strictEqual(sumEnhancePct(slots, 'attack'), 10);
assert.strictEqual(sumEnhancePct(slots, 'defense'), 5);
assert.strictEqual(canAddPoolEnhance(slots), false);

const state = buildDuplicateEnhanceState(slots);
assert.strictEqual(state.poolSlotsUsed, 2);
assert.strictEqual(state.canAttack, false);
assert.strictEqual(state.canDefense, false);

assert.throws(() => appendPoolEnhanceSlot(slots, 'attack'));

const char = attachEnhancePctToCharacter({ name: 'A' }, slots);
assert.strictEqual(char.characterEnhanceAttackPct, 10);
assert.strictEqual(char.characterEnhanceDefensePct, 5);

console.log('characterEnhanceCombat tests ok');
