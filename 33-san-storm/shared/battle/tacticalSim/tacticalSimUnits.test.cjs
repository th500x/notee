/**
 * 纯函数对照单测：tacticalAi（走位/选敌）+ formationModel（选阵/落位/加成）。
 *
 * 不依赖真实固化图，用手造 8×10 平原图与确定性兵组，验证：
 *  - formationModel.selectFormationForTroops 的优先级（进攻>平衡>防御）与 <3 兵回退。
 *  - formationModel.applyFormation 的双侧朝向（前锋朝敌）、buff 写入（_formationBuffs / movement / archer range）。
 *  - tacticalAi.findBestMoveTarget 的「打满射程 / 接近 / 弓兵后撤」与确定性（无 RNG，纯函数）。
 *
 * 运行：node shared/battle/tacticalSim/tacticalSimUnits.test.cjs
 */
const assert = require('assert');

/** 全平原 8×10 图（w=8,h=10），无障碍/火/陷阱 */
function makeFlatMap() {
  const terrain = Array.from({ length: 10 }, () => Array.from({ length: 8 }, () => 'plain'));
  return { terrain, objects: [], cellFire: null };
}

function mkUnit(over) {
  return {
    id: over.id,
    instanceId: over.id,
    side: over.side,
    faction: over.faction,
    troopType: over.troopType,
    weaponType: over.weaponType || (over.troopType === 'archer' ? 'archer_bow' : 'infantry_saber'),
    currentTroops: over.currentTroops ?? 1000,
    movement: over.movement ?? 3,
    range: over.range ?? (over.troopType === 'archer' ? 3 : 1),
    y: over.y,
    x: over.x,
  };
}

(async () => {
  const ai = await import('./tacticalAi.js');
  const fm = await import('./formationModel.js');
  const map = makeFlatMap();

  // ── formationModel.selectFormationForTroops ───────────────────────────────
  {
    // 含骑兵 → 进攻档 fengshi 优先
    const troops = [
      mkUnit({ id: 'c', side: 'a', faction: 'player', troopType: 'cavalry', y: 0, x: 3 }),
      mkUnit({ id: 'i1', side: 'a', faction: 'player', troopType: 'infantry', y: 0, x: 4 }),
      mkUnit({ id: 'i2', side: 'a', faction: 'player', troopType: 'infantry', y: 1, x: 3 }),
    ];
    const f = fm.selectFormationForTroops(troops, map.terrain);
    assert.ok(f, '应选出阵型');
    assert.strictEqual(f.id, 'fengshi', '含骑兵优先进攻档锋矢阵');
  }
  {
    // 无骑兵、含弓兵 + 双步兵 → 平衡档 heyi（reqTypes archer:1）；defensive yulin 也满足但平衡优先
    const troops = [
      mkUnit({ id: 'a1', side: 'a', faction: 'player', troopType: 'archer', y: 0, x: 3 }),
      mkUnit({ id: 'i1', side: 'a', faction: 'player', troopType: 'infantry', y: 0, x: 4 }),
      mkUnit({ id: 'i2', side: 'a', faction: 'player', troopType: 'infantry', y: 1, x: 3 }),
    ];
    const f = fm.selectFormationForTroops(troops, map.terrain);
    assert.strictEqual(f.id, 'heyi', '弓+双步优先平衡档鹤翼阵');
  }
  {
    // 仅 2 兵 → null
    const troops = [
      mkUnit({ id: 'i1', side: 'a', faction: 'player', troopType: 'infantry', y: 0, x: 3 }),
      mkUnit({ id: 'i2', side: 'a', faction: 'player', troopType: 'infantry', y: 0, x: 4 }),
    ];
    assert.strictEqual(fm.selectFormationForTroops(troops, map.terrain), null, '不足 3 兵不成阵');
  }

  // ── formationModel.applyFormation 朝向 + buff ──────────────────────────────
  {
    // side a：deployA(0-2)，敌在南(enemyDir +1)；锋矢前锋(dy -1)应落在更大 y（朝南/朝敌）
    const aUnits = [
      mkUnit({ id: 'a_cav', side: 'a', faction: 'player', troopType: 'cavalry', movement: 4, y: 1, x: 3 }),
      mkUnit({ id: 'a_i1', side: 'a', faction: 'player', troopType: 'infantry', y: 1, x: 4 }),
      mkUnit({ id: 'a_i2', side: 'a', faction: 'player', troopType: 'infantry', y: 0, x: 3 }),
    ];
    const bUnits = [
      mkUnit({ id: 'b_i', side: 'b', faction: 'enemy', troopType: 'infantry', y: 8, x: 3 }),
    ];
    const f = fm.selectFormationForTroops(aUnits, map.terrain);
    assert.strictEqual(f.id, 'fengshi');
    const res = fm.applyFormation(aUnits, map, {
      formation: f, deployRows: [0, 1, 2], enemyDir: 1, enemyUnits: bUnits,
    });
    assert.ok(res, 'a 侧应成功落阵');
    // 前锋（首个 shape 项，dy=-1）effective dy = -1 * (-enemyDir=-1) = +1 → 比两翼 y 大
    const vanguard = aUnits[0];
    const wing1 = aUnits[1];
    const wing2 = aUnits[2];
    assert.ok(vanguard.y > wing1.y && vanguard.y > wing2.y, 'a 锋矢前锋朝南(敌方)：y 更大');
    // buff：攻击 0.30、移动 +1
    assert.ok(aUnits.every((u) => u._formationBuffs && u._formationBuffs.attackBonus === 0.30), 'a 写入 attackBonus');
    assert.strictEqual(vanguard.movement, 5, 'a 骑兵 movement 4 + moveBonus 1 = 5');
  }
  {
    // side b：deployB(7-9)，敌在北(enemyDir -1)；锋矢前锋(dy -1)应落在更小 y（朝北/朝敌）
    const bUnits = [
      mkUnit({ id: 'b_cav', side: 'b', faction: 'enemy', troopType: 'cavalry', y: 8, x: 3 }),
      mkUnit({ id: 'b_i1', side: 'b', faction: 'enemy', troopType: 'infantry', y: 8, x: 4 }),
      mkUnit({ id: 'b_i2', side: 'b', faction: 'enemy', troopType: 'infantry', y: 9, x: 3 }),
    ];
    const aUnits = [mkUnit({ id: 'a_i', side: 'a', faction: 'player', troopType: 'infantry', y: 1, x: 3 })];
    const f = fm.selectFormationForTroops(bUnits, map.terrain);
    const res = fm.applyFormation(bUnits, map, {
      formation: f, deployRows: [7, 8, 9], enemyDir: -1, enemyUnits: aUnits,
    });
    assert.ok(res, 'b 侧应成功落阵');
    const vanguard = bUnits[0];
    assert.ok(vanguard.y < bUnits[1].y && vanguard.y < bUnits[2].y, 'b 锋矢前锋朝北(敌方)：y 更小');
  }
  {
    // 鹤翼阵 archer range +1（弓兵 weaponType archer_bow）
    const troops = [
      mkUnit({ id: 'arc', side: 'a', faction: 'player', troopType: 'archer', weaponType: 'archer_bow', range: 3, y: 1, x: 3 }),
      mkUnit({ id: 'i1', side: 'a', faction: 'player', troopType: 'infantry', y: 1, x: 4 }),
      mkUnit({ id: 'i2', side: 'a', faction: 'player', troopType: 'infantry', y: 0, x: 3 }),
    ];
    const f = fm.selectFormationForTroops(troops, map.terrain);
    assert.strictEqual(f.id, 'heyi');
    fm.applyFormation(troops, map, { formation: f, deployRows: [0, 1, 2], enemyDir: 1, enemyUnits: [] });
    const arc = troops.find((t) => t.troopType === 'archer');
    assert.strictEqual(arc.range, 4, '鹤翼弓兵 range 3 + rangeBonus 1 = 4');
    const inf = troops.find((t) => t.troopType === 'infantry');
    assert.strictEqual(inf.range, 1, '近战不吃 rangeBonus');
  }

  // ── tacticalAi.findBestMoveTarget ─────────────────────────────────────────
  {
    // 近战远离敌人 → 返回接近路径，无目标
    const atk = mkUnit({ id: 'm', side: 'a', faction: 'player', troopType: 'infantry', range: 1, movement: 3, y: 0, x: 3 });
    const enemy = mkUnit({ id: 'e', side: 'b', faction: 'enemy', troopType: 'infantry', y: 9, x: 3 });
    const units = [atk, enemy];
    const d1 = ai.findBestMoveTarget(atk, units, map, {});
    assert.ok(d1 && Array.isArray(d1.move) && d1.move.length > 0, '远距近战应有接近路径');
    assert.strictEqual(d1.target, null, '未进入射程不选目标');
    // 路径朝敌（y 递增）
    const last = d1.move[d1.move.length - 1];
    assert.ok(last.y > atk.y, '近战向敌方(南)移动');
  }
  {
    // 弓兵：敌在射程内但贴近 → 选目标；若能后撤拉远则给后撤路径
    const arc = mkUnit({ id: 'arc', side: 'a', faction: 'player', troopType: 'archer', range: 3, movement: 3, y: 4, x: 3 });
    const enemy = mkUnit({ id: 'e', side: 'b', faction: 'enemy', troopType: 'infantry', y: 5, x: 3 });
    const units = [arc, enemy];
    const d = ai.findBestMoveTarget(arc, units, map, {});
    assert.ok(d && d.target === enemy, '弓兵射程内应锁定敌人');
    if (d.move && d.move.length) {
      const last = d.move[d.move.length - 1];
      const newDist = Math.abs(last.y - enemy.y) + Math.abs(last.x - enemy.x);
      assert.ok(newDist > 1 && newDist <= arc.range, '弓兵后撤拉远但仍在射程内');
    }
  }
  {
    // 确定性：同输入连调 2 次结果一致（纯函数）
    const mk = () => {
      const atk = mkUnit({ id: 'm', side: 'a', faction: 'player', troopType: 'cavalry', range: 1, movement: 4, y: 0, x: 2 });
      const e1 = mkUnit({ id: 'e1', side: 'b', faction: 'enemy', troopType: 'infantry', y: 6, x: 2 });
      const e2 = mkUnit({ id: 'e2', side: 'b', faction: 'enemy', troopType: 'infantry', y: 6, x: 5 });
      return { atk, units: [atk, e1, e2] };
    };
    const a = mk(); const b = mk();
    const da = ai.findBestMoveTarget(a.atk, a.units, map, {});
    const db = ai.findBestMoveTarget(b.atk, b.units, map, {});
    assert.strictEqual(JSON.stringify(da.move), JSON.stringify(db.move), 'findBestMoveTarget 路径确定性');
  }

  console.log('tacticalSimUnits.test.cjs: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
