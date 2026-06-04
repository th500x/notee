/**
 * PvP 战术对决回放纯逻辑测试（pvpCanonicalView + pvpReplayState）：
 *  - buildInitialTroops：阵营 / 兵力 / 坐标（含 viewer='a' 纵向翻转）正确。
 *  - foldEvents 终态 ≡ 内核 finalState：逐 instanceId 比对 currentTroops 与坐标（视角变换后）。
 *  - winnerSide 与内核一致；faction 映射随 viewerSide 切换。
 *
 * 运行：node shared/battle/tacticalSim/pvpReplay.test.cjs
 */
const assert = require('assert');

/** 以 mapBuiltUnitsToSiegeNpcFormat 形状构建快照（与真实 accept 冻结一致） */
function npcLineup(side) {
  const mk = (id, troopType, weaponType, attack, defense, speed, movement, attackRange, troops, name) => ({
    index: 0,
    troopId: `san_1_troop_${side}_${id}`,
    troopName: name,
    rarity: 'rare',
    troopType,
    weaponType,
    attack,
    defense,
    speed,
    movement,
    attackRange,
    maxTroops: troops,
    currentTroops: troops,
    character: { name, courtesyName: name, luck: 50, courage: 55, combat: 60, command: 58, intelligence: 50 },
    _troopInstanceId: `${side}_${id}`,
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

(async () => {
  const kernel = await import('./runPvpTacticalDuel.js');
  const { makeCanonicalView } = await import('./pvpCanonicalView.js');
  const { buildInitialTroops, foldEvents } = await import('./pvpReplayState.js');
  const { buildDuelMapFromPreset } = await import('../../utils/pvpDuelMapCatalog.js');

  const DUEL_MAP_ID = 'duel_map_dev_flat';
  const snapshotsBySide = { a: npcLineup('a'), b: npcLineup('b') };

  const result = kernel.runPvpTacticalDuel({
    duelMapId: DUEL_MAP_ID,
    lineupSnapshots: { a: snapshotsBySide.a, b: snapshotsBySide.b },
    battleSeed: 0xC0FFEE,
  });
  const battleStart = result.events[0].payload;
  const finalById = new Map(result.finalState.units.map((u) => [u.instanceId, u]));

  for (const viewerSide of ['b', 'a', null]) {
    const canonical = buildDuelMapFromPreset(DUEL_MAP_ID);
    const view = makeCanonicalView(viewerSide, canonical);
    const flip = viewerSide === 'a';
    assert.strictEqual(view.flip, flip, `flip 判定 @${viewerSide}`);

    // 1) 初始棋盘：阵营 + 兵力 + 翻转坐标
    const { troops, byId } = buildInitialTroops(battleStart, view, snapshotsBySide);
    assert.strictEqual(troops.length, battleStart.units.length, `初始部队数 @${viewerSide}`);
    for (const u of battleStart.units) {
      const t = byId.get(u.instanceId);
      assert.ok(t, `部队存在 ${u.instanceId} @${viewerSide}`);
      // faction
      const expectFaction = viewerSide
        ? (u.side === viewerSide ? 'player' : 'enemy')
        : (u.side === 'a' ? 'player' : 'enemy');
      assert.strictEqual(t.faction, expectFaction, `faction ${u.instanceId} @${viewerSide}`);
      // 初始兵力 = BATTLE_START troops
      assert.strictEqual(t.currentTroops, u.troops, `初始兵力 ${u.instanceId} @${viewerSide}`);
      // 坐标变换
      const ey = flip ? view.h - 1 - u.y : u.y;
      assert.strictEqual(t.y, ey, `初始 y ${u.instanceId} @${viewerSide}`);
      assert.strictEqual(t.x, u.x, `初始 x ${u.instanceId} @${viewerSide}`);
    }

    // 2) 折叠终态 ≡ 内核 finalState
    const { winnerSide } = foldEvents(result.events, byId, view);
    assert.strictEqual(winnerSide, result.winnerSide, `winnerSide @${viewerSide}`);
    for (const [iid, fin] of finalById) {
      const t = byId.get(iid);
      assert.strictEqual(t.currentTroops, fin.currentTroops, `终态兵力 ${iid} @${viewerSide}`);
      const ey = flip ? view.h - 1 - fin.y : fin.y;
      assert.strictEqual(t.y, ey, `终态 y ${iid} @${viewerSide}`);
      assert.strictEqual(t.x, fin.x, `终态 x ${iid} @${viewerSide}`);
    }
  }

  // 3) 翻转地图：terrain 行倒序、维度不变
  const canonical = buildDuelMapFromPreset(DUEL_MAP_ID);
  const flippedView = makeCanonicalView('a', canonical);
  assert.strictEqual(flippedView.mapResult.terrain.length, canonical.terrain.length, '翻转后行数不变');
  assert.deepStrictEqual(
    flippedView.mapResult.terrain[0],
    canonical.terrain[canonical.terrain.length - 1],
    '翻转后首行 = 原末行',
  );

  console.log('pvpReplay.test.cjs: ok (viewer a/b/null × kernel finalState 对齐)');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
