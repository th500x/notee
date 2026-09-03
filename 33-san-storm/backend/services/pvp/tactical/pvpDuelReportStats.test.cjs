/**
 * pvpDuelReportStats 单测（纯函数 + 真实内核 finalState，无 DB）：
 *  - 跨方对称：A.damageDealt === B.damageTaken（反之亦然）。
 *  - kills：A.totalKills === 被歼灭的 B 单位数。
 *  - 评分自洽：score.details.killTroops === damageDealt、lossTroops === damageTaken。
 *  - buildScoreTroops：faction 映射 + rarity 取自快照。
 *
 * 运行：node backend/services/pvp/tactical/pvpDuelReportStats.test.cjs
 */
const assert = require('assert');
const {
  buildScoreTroops,
  buildSideStats,
  buildDuelReportForSide,
} = require('./pvpDuelReportStats');

function npcLineup(side) {
  const mk = (id, troopType, weaponType, rarity, attack, defense, speed, movement, attackRange, troops, name) => ({
    troopId: `san_1_troop_${side}_${id}`,
    troopName: name,
    rarity,
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
  });
  return side === 'a'
    ? [
        mk('inf', 'infantry', 'melee', 'rare', 62, 58, 48, 3, 1, 900, '甲·枪兵'),
        mk('cav', 'cavalry', 'melee', 'epic', 70, 50, 66, 4, 1, 800, '甲·骑兵'),
        mk('arc', 'archer', 'ranged', 'common', 58, 44, 52, 3, 3, 700, '甲·弓兵'),
      ]
    : [
        mk('inf', 'infantry', 'melee', 'common', 60, 60, 46, 3, 1, 900, '乙·枪兵'),
        mk('cav', 'cavalry', 'melee', 'rare', 68, 52, 64, 4, 1, 800, '乙·骑兵'),
        mk('arc', 'archer', 'ranged', 'legendary', 60, 42, 54, 3, 3, 700, '乙·弓兵'),
      ];
}

(async () => {
  const { runPvpTacticalDuel } = await import('../../../../shared/battle/tacticalSim/runPvpTacticalDuel.js');
  const lineupSnapshots = { a: npcLineup('a'), b: npcLineup('b') };

  const { finalState, rounds, winnerSide } = runPvpTacticalDuel({
    duelMapId: 'san_1_duel_balanced_1953079403',
    lineupSnapshots,
    battleSeed: 0xBEEF,
  });

  const resultA = winnerSide === 'a' ? 'win' : winnerSide === 'b' ? 'lose' : 'draw';
  const resultB = winnerSide === 'b' ? 'win' : winnerSide === 'a' ? 'lose' : 'draw';

  const a = buildDuelReportForSide({ finalState, lineupSnapshots, playerSide: 'a', rounds, result: resultA });
  const b = buildDuelReportForSide({ finalState, lineupSnapshots, playerSide: 'b', rounds, result: resultB });

  // 跨方对称
  assert.strictEqual(a.totalDamageDealt, b.totalDamageTaken, 'A 歼敌 = B 自损');
  assert.strictEqual(b.totalDamageDealt, a.totalDamageTaken, 'B 歼敌 = A 自损');

  // kills = 被歼灭的对方单位数
  const killedB = (finalState.units || []).filter((u) => u.side === 'b' && !u.alive).length;
  const killedA = (finalState.units || []).filter((u) => u.side === 'a' && !u.alive).length;
  assert.strictEqual(a.totalKills, killedB, 'A.kills = 被歼灭 B 单位数');
  assert.strictEqual(b.totalKills, killedA, 'B.kills = 被歼灭 A 单位数');

  // 评分自洽：details 兵力量纲与统计一致
  assert.strictEqual(a.score.details.killTroops, a.totalDamageDealt, 'score.killTroops = damageDealt');
  assert.strictEqual(a.score.details.lossTroops, a.totalDamageTaken, 'score.lossTroops = damageTaken');
  assert.ok(Number.isFinite(a.score.score), 'score 数值');
  assert.ok(typeof a.score.grade === 'string' && a.score.grade.length === 1, 'grade 档位');

  // buildScoreTroops：faction + rarity
  const troopsA = buildScoreTroops(finalState, lineupSnapshots, 'a');
  assert.strictEqual(troopsA.length, finalState.units.length, '计分单位数 = 总单位');
  for (const t of troopsA) {
    assert.ok(t.faction === 'player' || t.faction === 'enemy', 'faction 合法');
  }
  // 甲·弓兵（a 第 3 个，common）应在 player 阵营且 rarity=common
  const arcA = troopsA.find((t) => t.name === '甲·弓兵');
  assert.ok(arcA && arcA.faction === 'player' && arcA.rarity === 'common', '甲·弓兵 player/common');
  // 乙·弓兵（legendary）应在 a 视角为 enemy
  const arcBFromA = troopsA.find((t) => t.name === '乙·弓兵');
  assert.ok(arcBFromA && arcBFromA.faction === 'enemy' && arcBFromA.rarity === 'legendary', '乙·弓兵 enemy/legendary');

  // buildSideStats 与 report 一致
  const statsA = buildSideStats(finalState, 'a');
  assert.deepStrictEqual(
    { d: statsA.totalDamageDealt, t: statsA.totalDamageTaken, k: statsA.totalKills },
    { d: a.totalDamageDealt, t: a.totalDamageTaken, k: a.totalKills },
    'buildSideStats ≡ report 统计',
  );

  console.log(`pvpDuelReportStats.test.cjs: ok (winner=${winnerSide}, A score=${a.score.score}/${a.score.grade}, B score=${b.score.score}/${b.score.grade})`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
