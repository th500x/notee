/**
 * One-shot: infantry mirror tiers vs common-200 defender using estimateDamage (no ±10% rng).
 * Run: node scripts/troop-tier-damage-preview.mjs
 *
 * 精锐指数、弓兵近战乘子等均以 `../src/systems/combatSystem.js`（及攻城侧 `siegeCombatCore.cjs`）为准；本脚本不重复写死数值。
 */
import { estimateDamage } from '../src/systems/combatSystem.js';

const char = { combat: 5, command: 5, courage: 5, luck: 5 };
const plain = [['plain']];

function makeUnit({ attack, defense, maxTroops, rarity = 'common' }) {
  return {
    attack,
    defense,
    maxTroops,
    currentTroops: maxTroops,
    troopType: 'infantry',
    troopWeight: 1,
    rarity,
    infantryCounter: 1,
    cavalryCounter: 0.9,
    archerCounter: 1.1,
    plainAdapt: 1,
    hillAdapt: 1,
    forestAdapt: 1,
    character: char,
    morale: 70,
    y: 0,
    x: 0,
  };
}

const base200 = { attack: 3.8, defense: 6.2 };
const def200 = makeUnit({ ...base200, maxTroops: 200 });

const tiers = [
  { label: '200', max: 200, ...base200, rarity: 'common' },
  {
    label: '280',
    max: 280,
    attack: 4.6 * (280 / 460),
    defense: 8.6 * (280 / 460),
    rarity: 'rare',
  },
  {
    label: '360',
    max: 360,
    attack: 4.6 * (360 / 460),
    defense: 8.6 * (360 / 460),
    rarity: 'epic',
  },
  {
    label: '440',
    max: 440,
    attack: 5.4 * (440 / 600),
    defense: 9.8 * (440 / 600),
    rarity: 'legendary',
  },
  {
    label: '520',
    max: 520,
    attack: 5.4 * (520 / 600),
    defense: 9.8 * (520 / 600),
    rarity: 'core',
  },
  { label: '600', max: 600, attack: 5.4, defense: 9.8, rarity: 'core' },
];

for (const t of tiers) {
  const atk = makeUnit({
    attack: t.attack,
    defense: t.defense,
    maxTroops: t.max,
    rarity: t.rarity,
  });
  const toDef = estimateDamage(atk, def200, plain, { strike: 'normal' }).damage;
  const toAtk = estimateDamage(def200, atk, plain, { strike: 'counter' }).damage;
  const pctDef = (toDef / 200) * 100;
  const pctAtk = (toAtk / t.max) * 100;
  const ratio = pctDef / pctAtk;
  console.log(
    JSON.stringify({
      atkMax: t.label,
      dmgToDef200: toDef,
      pctDef: +pctDef.toFixed(1),
      counterToAtk: toAtk,
      pctAtk: +pctAtk.toFixed(1),
      ratio: +ratio.toFixed(2),
    }),
  );
}
