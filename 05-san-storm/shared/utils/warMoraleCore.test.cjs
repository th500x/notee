const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./warMoraleCore.cjs');

test('computeInitialWarMoralePair equal cities → 60/60', () => {
  const p = core.computeInitialWarMoralePair(10, 10);
  assert.equal(p.attackerWarMorale, 60);
  assert.equal(p.defenderWarMorale, 60);
});

test('computeInitialWarMoralePair 1 vs 100 → 100/20', () => {
  const p = core.computeInitialWarMoralePair(1, 100);
  assert.equal(p.attackerWarMorale, 100);
  assert.equal(p.defenderWarMorale, 20);
});

test('applyPvpAutoDuelMoraleDelta zero-sum ±1', () => {
  const d = core.applyPvpAutoDuelMoraleDelta(60, 60, true);
  assert.equal(d.attackerWarMorale, 61);
  assert.equal(d.defenderWarMorale, 59);
  assert.equal(d.attackerWarMorale + d.defenderWarMorale, 120);
});

test('resolveWarMoraleRaceWinner at 120', () => {
  assert.equal(core.resolveWarMoraleRaceWinner(120, 0), 'attacker');
  assert.equal(core.resolveWarMoraleRaceWinner(0, 120), 'defender');
  assert.equal(core.resolveWarMoraleRaceWinner(61, 59), null);
});
