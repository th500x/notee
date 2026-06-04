/**
 * PvP 战术对决推演内核测试：
 *  - 确定性：同 seed 连跑 2 次 → events + finalState + winner + rounds 完全一致。
 *  - 事件不变量：seq 连续无洞、首 BATTLE_START、尾 BATTLE_END、终态自洽。
 *  - 5 张真实固化对决图全跑通（含 river 图绕水寻路），无死循环/抛错。
 *  - 入参校验：缺 lineupSnapshots 抛错。
 *
 * 运行：node shared/battle/tacticalSim/runPvpTacticalDuel.test.cjs
 */
const assert = require('assert');

/** 冻结 lineup 快照（3 兵种混编，确定性数值；每次 new 对象避免引用串扰） */
function makeLineup(side) {
  const mk = (id, troopType, weaponType, attack, defense, speed, movement, range, troops, name) => ({
    id: `${side}_${id}`,
    name,
    rarity: 'rare',
    troopType,
    weaponType,
    attack,
    defense,
    speed,
    movement,
    range,
    maxTroops: troops,
    currentTroops: troops,
    character: { name, luck: 50, courage: 55, combat: 60, command: 58, intelligence: 50, politics: 40, charm: 45 },
  });
  return side === 'a'
    ? [
        mk('inf', 'infantry', 'melee', 62, 58, 48, 3, 1, 900, '甲·枪兵'),
        mk('cav', 'cavalry', 'melee', 70, 50, 66, 4, 1, 800, '甲·骑兵'),
        mk('arc', 'archer', 'ranged', 58, 44, 52, 3, 3, 700, '甲·弓兵'),
      ]
    : [
        mk('inf', 'infantry', 'melee', 60, 60, 46, 3, 1, 900, '乙·枪兵'),
        mk('cav', 'cavalry', 'melee', 68, 52, 64, 4, 1, 800, '乙·骑兵'),
        mk('arc', 'archer', 'ranged', 60, 42, 54, 3, 3, 700, '乙·弓兵'),
      ];
}

function run(kernel, duelMapId, battleSeed) {
  return kernel.runPvpTacticalDuel({
    duelMapId,
    lineupSnapshots: { a: makeLineup('a'), b: makeLineup('b') },
    battleSeed,
  });
}

function assertEventInvariants(result) {
  const { events, winnerSide, rounds } = result;
  assert.ok(events.length >= 2, 'events 至少含 START/END');
  events.forEach((e, i) => assert.strictEqual(e.seq, i, `seq 连续无洞 @${i}`));
  assert.strictEqual(events[0].type, 'BATTLE_START', '首事件为 BATTLE_START');
  const last = events[events.length - 1];
  assert.strictEqual(last.type, 'BATTLE_END', '尾事件为 BATTLE_END');
  assert.strictEqual(last.payload.winnerSide, winnerSide, 'BATTLE_END.winnerSide 与返回一致');
  assert.strictEqual(last.payload.rounds, rounds, 'BATTLE_END.rounds 与返回一致');

  // 终态自洽：胜方应有存活兵力（平局除外）
  const { troopsRemain } = result.finalState;
  if (winnerSide === 'a') assert.ok(troopsRemain.a > 0 && troopsRemain.b === 0, 'a 胜：a 有兵 b 无兵');
  if (winnerSide === 'b') assert.ok(troopsRemain.b > 0 && troopsRemain.a === 0, 'b 胜：b 有兵 a 无兵');

  // BATTLE_START 放兵分区：a∈deployA(0-2)，b∈deployB(7-9)
  for (const u of events[0].payload.units) {
    if (u.side === 'a') assert.ok(u.y >= 0 && u.y <= 2, 'a 部署于北带');
    if (u.side === 'b') assert.ok(u.y >= 7 && u.y <= 9, 'b 部署于南带');
  }

  // FORMATION_APPLIED（若出现）：结构自洽、位于 ROUND_START 之前
  const firstRoundIdx = events.findIndex((e) => e.type === 'ROUND_START');
  for (const e of events.filter((x) => x.type === 'FORMATION_APPLIED')) {
    assert.ok(e.payload.side === 'a' || e.payload.side === 'b', 'FORMATION_APPLIED.side 合法');
    assert.ok(e.payload.formationId && e.payload.formationName, 'FORMATION_APPLIED 含阵型标识');
    assert.ok(e.payload.effects && typeof e.payload.effects === 'object', 'FORMATION_APPLIED 含 effects');
    assert.ok(Array.isArray(e.payload.units) && e.payload.units.length >= 3, 'FORMATION_APPLIED 含落位');
    assert.ok(firstRoundIdx === -1 || e.seq < events[firstRoundIdx].seq, '阵型事件在首回合前');
  }
}

(async () => {
  const kernel = await import('./runPvpTacticalDuel.js');
  const catalog = await import('../../utils/pvpDuelMapCatalog.js');
  const poolIds = catalog.DUEL_MAP_POOL_IDS && catalog.DUEL_MAP_POOL_IDS.length
    ? catalog.DUEL_MAP_POOL_IDS
    : catalog.DUEL_MAP_PRESET_IDS;
  assert.ok(poolIds.length > 0, '对决地图池非空');

  let totalFormationEvents = 0;
  for (const duelMapId of poolIds) {
    const seed = 0x51a7e1 ^ (duelMapId.length * 2654435761);
    const r1 = run(kernel, duelMapId, seed);
    const r2 = run(kernel, duelMapId, seed);

    assert.strictEqual(JSON.stringify(r1.events), JSON.stringify(r2.events), `[${duelMapId}] events 确定性`);
    assert.strictEqual(JSON.stringify(r1.finalState), JSON.stringify(r2.finalState), `[${duelMapId}] finalState 确定性`);
    assert.strictEqual(r1.winnerSide, r2.winnerSide, `[${duelMapId}] winner 确定性`);
    assert.strictEqual(r1.rounds, r2.rounds, `[${duelMapId}] rounds 确定性`);
    assert.ok(r1.rounds >= 1 && r1.rounds <= kernel.MAX_TACTICAL_ROUNDS, `[${duelMapId}] 回合数合理`);
    assert.ok(Array.isArray(r1.battleLog) && r1.battleLog.length > 0, `[${duelMapId}] battleLog 非空`);
    assertEventInvariants(r1);
    totalFormationEvents += r1.events.filter((e) => e.type === 'FORMATION_APPLIED').length;
  }

  // 测试编组含骑兵+双近战 → 锋矢/鱼鳞可成阵；至少一图应触发 FORMATION_APPLIED，证明阵型链路生效
  assert.ok(totalFormationEvents > 0, '应至少有一场触发首回合阵型');

  // ── 阶段 1 城防（defenseBonus）对照冒烟（17-5-3 §阶段1）──
  {
    const mapId = poolIds[0];
    const seed = 0xc17ade;
    const lineup = () => ({ a: makeLineup('a'), b: makeLineup('b') });
    const base = kernel.runPvpTacticalDuel({ duelMapId: mapId, lineupSnapshots: lineup(), battleSeed: seed });
    // 1) 带 defenseBonus 仍确定性（同 seed 连跑 2 次完全一致）
    const d1 = kernel.runPvpTacticalDuel({ duelMapId: mapId, lineupSnapshots: lineup(), battleSeed: seed, defenseBonus: { b: 100000 } });
    const d2 = kernel.runPvpTacticalDuel({ duelMapId: mapId, lineupSnapshots: lineup(), battleSeed: seed, defenseBonus: { b: 100000 } });
    assert.strictEqual(JSON.stringify(d1.events), JSON.stringify(d2.events), 'defenseBonus 路径事件确定性');
    assert.strictEqual(JSON.stringify(d1.finalState), JSON.stringify(d2.finalState), 'defenseBonus 路径终态确定性');
    // 2) 极高城防的 b 几乎免伤 → b 存活兵力应高于无城防基线，且 b 胜
    assert.ok(
      d1.finalState.troopsRemain.b >= base.finalState.troopsRemain.b,
      `城防使 b 减员不增（defended=${d1.finalState.troopsRemain.b} base=${base.finalState.troopsRemain.b}）`,
    );
    assert.strictEqual(d1.winnerSide, 'b', '极高城防的 b 应获胜');
  }

  // 入参校验
  assert.throws(
    () => kernel.runPvpTacticalDuel({ duelMapId: poolIds[0], battleSeed: 1 }),
    /lineupSnapshots/,
    '缺 lineupSnapshots 应抛错',
  );
  assert.throws(
    () => kernel.runPvpTacticalDuel({ lineupSnapshots: { a: makeLineup('a'), b: makeLineup('b') }, battleSeed: 1 }),
    /duelMapId 或 preset/,
    '缺地图来源应抛错',
  );

  console.log(`runPvpTacticalDuel.test.cjs: ok (${poolIds.length} maps)`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
