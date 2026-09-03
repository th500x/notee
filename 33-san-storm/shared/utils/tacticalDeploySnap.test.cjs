/**
 * 部署吸附：必须有地图；河格不得落子；同 seed 可复现
 * node shared/utils/tacticalDeploySnap.test.cjs
 */
const assert = require('assert');
const {
  isTacticalCellDeployable,
  snapDeployPositions,
  assertTroopsNotOnUndeployableTerrain,
} = require('./tacticalDeploySnap.cjs');
const { generateSmallMapV2 } = require('./mapGenerator_v2.cjs');

assert.strictEqual(isTacticalCellDeployable(0, 0, null), false, '无地图不可部署');

let threw = false;
try {
  snapDeployPositions([{ y: 8, x: 4 }], null);
} catch {
  threw = true;
}
assert.ok(threw, '无地图必须抛错，禁止静默回退');

// 强制有河的图：多试几个种子，直到南部署带有河
let map = null;
for (let seed = 1; seed < 200; seed += 1) {
  const m = generateSmallMapV2({ seed, skipChest: true, skipRandom: true, skipFarm: true });
  const southHasRiver = [7, 8, 9].some((y) =>
    (m.terrain[y] || []).some((t) => t === 'river' || t === 'lake'),
  );
  const northHasRiver = [0, 1, 2].some((y) =>
    (m.terrain[y] || []).some((t) => t === 'river' || t === 'lake'),
  );
  if (southHasRiver && northHasRiver) {
    map = m;
    break;
  }
}
assert.ok(map, '未能生成南北部署带含水的样例图');

const playerPreferred = [
  { y: 8, x: 1 }, { y: 8, x: 4 }, { y: 8, x: 7 },
  { y: 9, x: 2 }, { y: 9, x: 5 },
];
const enemyPreferred = [
  { y: 0, x: 1 }, { y: 0, x: 5 },
  { y: 1, x: 3 }, { y: 1, x: 7 },
];
const playerPos = snapDeployPositions(playerPreferred, map, { label: 'player' });
const enemyPos = snapDeployPositions(enemyPreferred, map, { label: 'enemy' });
for (const p of [...playerPos, ...enemyPos]) {
  assert.ok(isTacticalCellDeployable(p.y, p.x, map), `吸附后仍在河上 ${p.y},${p.x}`);
}

const fakeTroops = [
  ...playerPos.map((p, i) => ({ id: `p${i}`, y: p.y, x: p.x, currentTroops: 1 })),
  ...enemyPos.map((p, i) => ({ id: `e${i}`, y: p.y, x: p.x, currentTroops: 1 })),
];
assertTroopsNotOnUndeployableTerrain(fakeTroops, map);

// 故意站河应被 assert 抓到
let assertCaught = false;
try {
  let riverCell = null;
  for (let y = 0; y < map.terrain.length && !riverCell; y++) {
    for (let x = 0; x < map.terrain[0].length; x++) {
      if (map.terrain[y][x] === 'river') {
        riverCell = { y, x };
        break;
      }
    }
  }
  assert.ok(riverCell, '样例应含水');
  assertTroopsNotOnUndeployableTerrain(
    [{ id: 'bad', y: riverCell.y, x: riverCell.x, currentTroops: 1 }],
    map,
  );
} catch {
  assertCaught = true;
}
assert.ok(assertCaught, '站河部队必须被 assert 拒绝');

console.log('tacticalDeploySnap.test.cjs: ok');
