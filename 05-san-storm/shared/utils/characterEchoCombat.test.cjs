const assert = require('assert');
const {
  parseEchoSlots,
  countPoolEchoSlots,
  canAddPoolEcho,
  appendPoolEchoSlot,
  sumEchoPct,
  attachEchoPctToCharacter,
  buildEchoState,
  getNextPoolEchoPct,
} = require('./characterEchoCombat.cjs');

const empty = parseEchoSlots(null);
assert.deepStrictEqual(empty, [null, null, null]);
assert.strictEqual(countPoolEchoSlots(empty), 0);
assert.strictEqual(canAddPoolEcho(empty), true);
assert.strictEqual(getNextPoolEchoPct(empty), 10);

let slots = appendPoolEchoSlot(empty, 'attack');
assert.strictEqual(slots[0].kind, 'attack');
assert.strictEqual(slots[0].pct, 10);
assert.strictEqual(slots[0].source, 'pool');
assert.strictEqual(sumEchoPct(slots, 'attack'), 10);
assert.strictEqual(sumEchoPct(slots, 'defense'), 0);

slots = appendPoolEchoSlot(slots, 'defense');
assert.strictEqual(slots[1].pct, 5);
assert.strictEqual(sumEchoPct(slots, 'attack'), 10);
assert.strictEqual(sumEchoPct(slots, 'defense'), 5);
assert.strictEqual(canAddPoolEcho(slots), false);

const state = buildEchoState(slots);
assert.strictEqual(state.poolSlotsUsed, 2);
assert.strictEqual(state.canAttack, false);
assert.strictEqual(state.canDefense, false);

assert.throws(() => appendPoolEchoSlot(slots, 'attack'));

const char = attachEchoPctToCharacter({ name: 'A' }, slots);
assert.strictEqual(char.characterEchoAttackPct, 10);
assert.strictEqual(char.characterEchoDefensePct, 5);

console.log('characterEchoCombat tests ok');
