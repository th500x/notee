/**
 * PvP 对决地图生成器：同 seed + 同 preset 可复现；禁 chest/trap
 */
const assert = require('assert');
const { generatePvpDuelMap } = require('./pvpDuelMapGenerator.js');
const { buildTemplatePreset } = require('./pvpDuelMapRuleTemplates.js');

const preset = {
  ...buildTemplatePreset('balanced'),
  seed: 8844221,
};

const a = generatePvpDuelMap(preset, { seed: 8844221 });
const b = generatePvpDuelMap(preset, { seed: 8844221 });

assert.strictEqual(JSON.stringify(a.terrain), JSON.stringify(b.terrain));
assert.strictEqual(JSON.stringify(a.objects), JSON.stringify(b.objects));

const forbidden = a.objects.filter(
  (o) => o.type === 'chest' || o.type === 'trap' || o.type === 'farm' || o.type === 'random',
);
assert.strictEqual(forbidden.length, 0, 'PvP duel map must not contain chest/trap/farm/random');
assert.ok(a.baseTileRel?.[0]?.[0], 'v2 wang base');
assert.strictEqual(a.meta?.baseGenerator, 'v2');

const riverPreset = { ...buildTemplatePreset('river'), seed: 10001 };
const riverMap = generatePvpDuelMap(riverPreset, { seed: 10001 });
let riverCount = 0;
for (let y = 0; y < riverMap.terrain.length; y++) {
  for (let x = 0; x < riverMap.terrain[0].length; x++) {
    if (riverMap.terrain[y][x] === 'river') riverCount++;
  }
}
assert.ok(riverCount >= 6, 'river profile should place multiple river cells');
const band = riverMap.meta?.crossRiverBand;
assert.ok(band && band.leftRoad != null && band.rightRoad != null, 'river band meta');
for (const y of band.rows) {
  assert.strictEqual(riverMap.terrain[y][band.leftRoad], 'plain', 'left road column');
  assert.strictEqual(riverMap.terrain[y][band.rightRoad], 'plain', 'right road column');
}

console.log('pvpDuelMapGenerator.test.cjs: ok');
