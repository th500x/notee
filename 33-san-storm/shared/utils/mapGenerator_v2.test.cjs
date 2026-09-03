/**
 * mapGenerator_v2 冒烟：同 seed 可复现；含 syncMapResultVisualsFromTerrain
 * node shared/utils/mapGenerator_v2.test.cjs
 */
const assert = require('assert');
const {
  generateSmallMapV2,
  syncMapResultVisualsFromTerrain,
} = require('./mapGenerator_v2.cjs');

const a = generateSmallMapV2({ seed: 424242, skipChest: true });
const b = generateSmallMapV2({ seed: 424242, skipChest: true });
assert.strictEqual(JSON.stringify(a.terrain), JSON.stringify(b.terrain));
assert.strictEqual(JSON.stringify(a.baseTileRel), JSON.stringify(b.baseTileRel));
assert.ok(a.baseTileRel?.[0]?.[0], 'wang base tile');
assert.strictEqual(a.meta.generator, 'v2');

const flat = generateSmallMapV2({ seed: 7, skipRiver: true, skipChest: true, skipRandom: true, skipFarm: true });
flat.terrain[4][3] = 'river';
flat.terrain[4][4] = 'river';
flat.terrain[5][2] = 'forest';
flat.terrain[5][3] = 'forest';
flat.terrain[6][4] = 'hill';
syncMapResultVisualsFromTerrain(flat, { seed: 7 });
assert.ok(flat.baseTileRel?.[4]?.[3], 'synced wang');
assert.ok(flat.terrainOverlays?.forests?.length >= 1, 'forest stamps from sync');
assert.ok(flat.terrainOverlays?.hills?.some((h) => h.x === 4 && h.y === 6), 'hill stamp');
assert.strictEqual(flat.terrain[4][3], 'river', 'sync must not rewrite terrain');

console.log('mapGenerator_v2.test.cjs: ok');
