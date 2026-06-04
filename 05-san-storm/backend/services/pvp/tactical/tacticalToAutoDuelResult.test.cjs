/**
 * tacticalToAutoDuelResult 适配器测试（17-5-3 阶段 2）
 *  - 纯映射：跨方对位、faction 标注、killedIndices 仅守方、index↔snapshot、defenderLineupTroopUpdates。
 *  - 下游契约：产出可直接喂 buildTroopsFor*Score + calculateBattleScore 得有限分。
 *  - 真实内核 round-trip：兵力守恒（Σcurrent == finalState.troopsRemain）、attackerWon 与 winnerSide 一致。
 *
 * 运行：node backend/services/pvp/tactical/tacticalToAutoDuelResult.test.cjs
 */
const assert = require('assert');
const { tacticalToAutoDuelResult } = require('./tacticalToAutoDuelResult');
const {
  calculateBattleScore,
  buildTroopsForAttackerScore,
  buildTroopsForDefenderScore,
} = require('../../../utils/battleScore.cjs');

// ── 1) 纯映射 ──────────────────────────────────────────────
{
  const attackerSnapshot = [
    { index: 0, rarity: 'rare', troopType: 'infantry', maxTroops: 1000, currentTroops: 1000 },
    { index: 1, rarity: 'common', troopType: 'cavalry', maxTroops: 800, currentTroops: 800 },
  ];
  const defenderSnapshot = [
    { index: 5, rarity: 'epic', troopType: 'archer', maxTroops: 700, currentTroops: 700, _troopInstanceId: 'inst-D5' },
    { index: 9, rarity: 'common', troopType: 'infantry', maxTroops: 900, currentTroops: 900, _troopInstanceId: 'inst-D9' },
  ];
  const finalState = {
    units: [
      { instanceId: 'a_0', side: 'a', currentTroops: 640, initialTroops: 1000, alive: true },
      { instanceId: 'a_1', side: 'a', currentTroops: 0, initialTroops: 800, alive: false },
      { instanceId: 'b_0', side: 'b', currentTroops: 0, initialTroops: 700, alive: false },
      { instanceId: 'b_1', side: 'b', currentTroops: 120, initialTroops: 900, alive: true },
    ],
    survivors: { a: 1, b: 1 },
    troopsRemain: { a: 640, b: 120 },
  };

  const r = tacticalToAutoDuelResult({ winnerSide: 'a', finalState, attackerSnapshot, defenderSnapshot });

  assert.strictEqual(r.attackerWon, true, 'winnerSide a ⇒ attackerWon');
  assert.strictEqual(r.winnerSide, 'a');

  // 跨方对位 + faction
  assert.deepStrictEqual(r.attackerTroopsEnd.map((t) => t.currentTroops), [640, 0], '攻方收尾对位 a_*');
  assert.deepStrictEqual(r.defenderTroopsEnd.map((t) => t.currentTroops), [0, 120], '守方收尾对位 b_*');
  assert.ok(r.attackerTroopsEnd.every((t) => t.faction === 'player'), '攻方 faction=player');
  assert.ok(r.defenderTroopsEnd.every((t) => t.faction === 'enemy'), '守方 faction=enemy');
  assert.strictEqual(r.attackerTroopsEnd[0].initialTroops, 1000, 'initialTroops 来自开战兵力');
  assert.strictEqual(r.attackerTroopsEnd[0].rarity, 'rare', 'rarity 透传');

  // killedIndices：仅守方阵亡，用 snap.index
  assert.deepStrictEqual(r.killedIndices, [5], 'killedIndices 用守方 npc.index（仅阵亡）');

  // defenderLineupTroopUpdates
  assert.deepStrictEqual(
    r.defenderLineupTroopUpdates,
    [
      { instanceId: 'inst-D5', maxTroops: 700, currentTroops: 0 },
      { instanceId: 'inst-D9', maxTroops: 900, currentTroops: 120 },
    ],
    'defenderLineupTroopUpdates 对位 + 兵力',
  );
}

// ── 2) 下游契约：可喂计分器 ──────────────────────────────────
{
  const attackerSnapshot = [{ index: 0, rarity: 'rare', maxTroops: 1000, currentTroops: 1000 }];
  const defenderSnapshot = [{ index: 0, rarity: 'rare', maxTroops: 1000, currentTroops: 1000, _troopInstanceId: 'd0' }];
  const finalState = {
    units: [
      { instanceId: 'a_0', side: 'a', currentTroops: 800, initialTroops: 1000 },
      { instanceId: 'b_0', side: 'b', currentTroops: 0, initialTroops: 1000 },
    ],
    survivors: { a: 1, b: 0 },
    troopsRemain: { a: 800, b: 0 },
  };
  const r = tacticalToAutoDuelResult({ winnerSide: 'a', finalState, attackerSnapshot, defenderSnapshot });

  const atk = calculateBattleScore(
    buildTroopsForAttackerScore(r.attackerTroopsEnd, r.defenderTroopsEnd),
    12,
    'victory',
  );
  const def = calculateBattleScore(
    buildTroopsForDefenderScore(r.attackerTroopsEnd, r.defenderTroopsEnd),
    12,
    'defeat',
  );
  assert.ok(Number.isFinite(atk.score) && atk.score >= 0, '攻方计分有限非负');
  assert.ok(Number.isFinite(def.score) && def.score >= 0, '守方计分有限非负');
  assert.ok(atk.score > def.score, '全歼守方 → 攻方分高于守方');
}

// ── 3) 平局 + 缺失 finalUnit 安全退化 ──────────────────────────
{
  const r = tacticalToAutoDuelResult({
    winnerSide: null,
    finalState: { units: [], survivors: { a: 0, b: 0 }, troopsRemain: { a: 0, b: 0 } },
    attackerSnapshot: [{ index: 0, maxTroops: 500, currentTroops: 500 }],
    defenderSnapshot: [{ index: 0, maxTroops: 500, currentTroops: 500 }],
  });
  assert.strictEqual(r.attackerWon, false, '平局 ⇒ attackerWon=false');
  assert.strictEqual(r.attackerTroopsEnd[0].currentTroops, 500, '缺 finalUnit 退化为快照开战兵力');
  assert.deepStrictEqual(r.killedIndices, [], '守方未阵亡（退化兵力>0）');
  assert.deepStrictEqual(r.defenderLineupTroopUpdates, [], '无 _troopInstanceId ⇒ 不产更新');
}

// ── 4) 入参校验 ──────────────────────────────────────────────
assert.throws(() => tacticalToAutoDuelResult({ finalState: {}, attackerSnapshot: [], defenderSnapshot: [] }), /finalState\.units/);
assert.throws(() => tacticalToAutoDuelResult({ finalState: { units: [] }, attackerSnapshot: null, defenderSnapshot: [] }), /Snapshot/);

// ── 5) 真实内核 round-trip ───────────────────────────────────
(async () => {
  const kernel = await import('../../../../shared/battle/tacticalSim/runPvpTacticalDuel.js');
  const catalog = await import('../../../../shared/utils/pvpDuelMapCatalog.js');
  const mapId = (catalog.DUEL_MAP_POOL_IDS && catalog.DUEL_MAP_POOL_IDS[0]) || catalog.DUEL_MAP_PRESET_IDS[0];

  const mk = (side, idx, troopType, atk, def, spd, mov, range, troops) => ({
    index: idx,
    id: `${side}_${idx}`,
    rarity: 'rare',
    troopType,
    weaponType: troopType === 'archer' ? 'ranged' : 'melee',
    attack: atk, defense: def, speed: spd, movement: mov, range,
    maxTroops: troops, currentTroops: troops,
    _troopInstanceId: `inst-${side}-${idx}`,
    character: { name: `${side}${idx}`, luck: 50, courage: 55, combat: 60, command: 58, intelligence: 50, politics: 40, charm: 45 },
  });
  const attackerSnapshot = [mk('a', 0, 'infantry', 64, 56, 48, 3, 1, 900), mk('a', 1, 'cavalry', 72, 50, 66, 4, 1, 800)];
  const defenderSnapshot = [mk('b', 0, 'archer', 58, 44, 52, 3, 3, 700), mk('b', 1, 'infantry', 60, 60, 46, 3, 1, 900)];

  const res = kernel.runPvpTacticalDuel({
    duelMapId: mapId,
    lineupSnapshots: {
      a: attackerSnapshot.map((s) => ({ ...s })),
      b: defenderSnapshot.map((s) => ({ ...s })),
    },
    battleSeed: 0xadd1c7,
  });

  const r = tacticalToAutoDuelResult({
    winnerSide: res.winnerSide,
    finalState: res.finalState,
    attackerSnapshot,
    defenderSnapshot,
  });

  assert.strictEqual(r.attackerWon, res.winnerSide === 'a', 'attackerWon 与内核 winnerSide 一致');
  const sumA = r.attackerTroopsEnd.reduce((s, t) => s + t.currentTroops, 0);
  const sumB = r.defenderTroopsEnd.reduce((s, t) => s + t.currentTroops, 0);
  assert.strictEqual(sumA, res.finalState.troopsRemain.a, '攻方兵力守恒 == troopsRemain.a');
  assert.strictEqual(sumB, res.finalState.troopsRemain.b, '守方兵力守恒 == troopsRemain.b');

  const eliminatedB = res.finalState.units.filter((u) => u.side === 'b' && u.currentTroops <= 0).length;
  assert.strictEqual(r.killedIndices.length, eliminatedB, 'killedIndices 数 == 守方阵亡数');
  assert.strictEqual(r.defenderLineupTroopUpdates.length, defenderSnapshot.length, '每守方单位一条更新');

  console.log(`tacticalToAutoDuelResult.test.cjs: ok (map=${mapId}, winner=${res.winnerSide}, killedB=${eliminatedB})`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
