/**
 * 章节生图烟测：roster 展开数量、同 seed 可复现、部署区不足时抛错。
 * 与 mapGenerator_v2.test.cjs 同风格，由 scripts/run-automated-checks.cjs 调起。
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { generateChapterStageMap } = require('./chapterStageMapGenerator.cjs');
const { parseChapterStageRoster } = require('./chapterStageRoster.cjs');

const LABEL = 'chapterStageMapGenerator.test.cjs';

/** 独立于被测解析器的期望值：按 `troop_id:N` 求和，防止「解析器少展开、断言跟着少」 */
function expectedCountFromSpec(spec, factions) {
  if (!spec) return 0;
  let n = 0;
  for (const seg of String(spec).split('||')) {
    const bits = seg.split('|').map((s) => s.trim()).filter(Boolean);
    if (bits.length < 3 || !factions.includes(bits[0])) continue;
    const m = /^[^:]+(?::(\d+))?$/.exec(bits[2]);
    n += m && m[1] ? parseInt(m[1], 10) : 1;
  }
  return n;
}

function countUnits(result, faction) {
  let n = 0;
  for (const row of result.cells) {
    for (const cell of row) {
      const cu = cell?.campaignUnit;
      if (cu && (faction ? cu.faction === faction : true)) n += 1;
    }
  }
  return n;
}

// 1. `troop_id:N` 展开为 N 个部队（与战役 expandCampaignUnitsSpec 同义）
{
  const units = parseChapterStageRoster('enemy|c1|t1:3|morale:40||enemy|c2|t2');
  assert.strictEqual(units.length, 4, 'stack 未按份数展开');
  assert.strictEqual(units.filter((u) => u.troopId === 't1').length, 3);
  assert.strictEqual(units[0].stackTotal, 3);
  assert.strictEqual(units[3].stackTotal, 1);
}

// 2. 真实关卡数据：地图上敌军/友军数量 = roster 展开数量
{
  const jsonPath = path.resolve(__dirname, '../../public/data/shared/chapterStages.json');
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const stages = Array.isArray(raw) ? raw : raw.stages || [];
  assert.ok(stages.length > 0, 'chapterStages.json 无数据');
  for (const st of stages) {
    const stage = {
      stage_id: st.stageId,
      map_w: st.mapW,
      map_h: st.mapH,
      deploy_pattern: st.deployPattern,
      terrain_brief: st.terrainBrief,
      terrain_ratios: st.terrainRatios,
      enemy_roster: st.enemyRoster,
      ally_roster: st.allyRoster,
      map_seed: st.mapSeed,
    };
    const expectedEnemies = expectedCountFromSpec(st.enemyRoster, ['enemy']);
    const expectedAllies = expectedCountFromSpec(st.allyRoster, ['ally1', 'ally2']);
    assert.ok(expectedEnemies > 0, `${st.stageId} 敌军 roster 为空`);
    const result = generateChapterStageMap(stage);
    assert.strictEqual(
      countUnits(result, 'enemy'),
      expectedEnemies,
      `${st.stageId} 敌军数量不符（期望 ${expectedEnemies}）`,
    );
    assert.strictEqual(
      countUnits(result, 'ally1') + countUnits(result, 'ally2'),
      expectedAllies,
      `${st.stageId} 友军数量不符（期望 ${expectedAllies}）`,
    );

    // 同 seed 可复现
    const again = generateChapterStageMap(stage, { seed: result.seed });
    assert.strictEqual(again.seed, result.seed);
    assert.strictEqual(JSON.stringify(again.cells), JSON.stringify(result.cells), `${st.stageId} 同 seed 不可复现`);
  }
}

// 3. roster 超出部署区可用格时必须抛错，不静默少放
{
  const many = Array.from({ length: 60 }, (_, i) => `enemy|c${i}|san_1_troop_7003`).join('||');
  assert.throws(
    () => generateChapterStageMap({ stage_id: 'overflow_stage', map_w: 8, map_h: 8, enemy_roster: many }),
    /少于 roster 部队数/,
    '部署区不足时未抛错',
  );
}

console.log(`${LABEL}: ok`);
