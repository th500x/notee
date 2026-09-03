/**
 * AI 君主 M2 主动决策 + 调度器冒烟测试（仅 dev 本地）。
 *
 * 覆盖：
 *   1. `aiKingPersonalityEff.computeSaturatedPersonality`：未饱和 / 已饱和的 *_eff 推导
 *   2. `aiKingHourlyScheduler.planSlotsForHour`：N=1/2/3 的时段等分 + 段内随机 + 重启重掷
 *   3. `aiKingHourlyScheduler.AiKingHourlyScheduler.runMinuteTick`：注入 now/rng，验证按 slot 触发
 *   4. `passiveApprovalService.resolvePassiveApproval`：传入 cityCount → 启用 *_eff
 *   5. `aiKingActiveDecisionService.weightedPick`：权重为 0 / 全 0 边界
 *
 * 不依赖数据库；不会调用 createPvpWarDraft（除非显式 ENV 开启）。
 *
 * 用法：node backend/scripts/_dev_ai_king_smoke.cjs
 */

require('dotenv').config({ path: __dirname + '/../.env' });

const path = require('path');
const {
  computeSaturatedPersonality,
  cityCountSaturationFromAmbition,
  pickEffByProposalType,
} = require(path.join('..', 'utils', 'aiKingPersonalityEff'));
const {
  planSlotsForHour,
  buildHourSlotIntervals,
  AiKingHourlyScheduler,
  hourStartMs,
  MS_PER_HOUR,
} = require(path.join('..', 'services', 'aiKingHourlyScheduler'));
const aiKingConfigService = require(path.join('..', 'services', 'aiKingConfigService'));
const passiveApprovalService = require(path.join(
  '..', 'services', 'passiveApprovalService',
));
const aiKingActiveDecisionService = require(path.join(
  '..', 'services', 'aiKingActiveDecisionService',
));
const policyProposalAssessService = require(path.join(
  '..', 'services', 'policyProposalAssessService',
));
const factionPolicyDefaults = require(path.join(
  '..', 'services', 'factionPolicyDefaults',
));

let pass = 0;
let fail = 0;
function expect(label, cond, extra) {
  if (cond) {
    pass += 1;
    console.log(`✓ ${label}`);
  } else {
    fail += 1;
    console.error(`✗ ${label}`, extra ? JSON.stringify(extra) : '');
  }
}

(async () => {
  // ─────────── 1) 性格饱和调制 ───────────
  const lingdi = aiKingConfigService.getKingByFactionId('san_1_faction_2001');
  const zhangjiao = aiKingConfigService.getKingByFactionId('san_1_faction_3001');
  const liubei = aiKingConfigService.getKingByFactionId('san_1_faction_1001');

  expect('ambition→saturationCity 0.2 → 20', cityCountSaturationFromAmbition(0.2) === 20);
  expect('ambition→saturationCity 0.9 → 90', cityCountSaturationFromAmbition(0.9) === 90);

  const lingdiUnsat = computeSaturatedPersonality(lingdi, 5);
  expect('lingdi cc=5 < 20: 未饱和', lingdiUnsat.saturated === false);
  expect('lingdi 未饱和 aggressionEff = aggression 原值 0.2', lingdiUnsat.aggressionEff === 0.2);

  const zhangjiaoSat = computeSaturatedPersonality(zhangjiao, 95);
  expect('zhangjiao cc=95 ≥ 90: 已饱和', zhangjiaoSat.saturated === true);
  // aggression=1, aggressionFactor=0.7 → eff=0.7
  expect(
    'zhangjiao 饱和 aggressionEff = clamp(1 × 0.7) = 0.7',
    Math.abs(zhangjiaoSat.aggressionEff - 0.7) < 1e-9,
    zhangjiaoSat,
  );
  expect(
    'zhangjiao 饱和 cautionEff = clamp(0.2 × 1.5) = 0.3',
    Math.abs(zhangjiaoSat.cautionEff - 0.3) < 1e-9,
  );

  expect(
    'pickEffByProposalType war = aggressionEff',
    pickEffByProposalType(zhangjiaoSat, 'war') === zhangjiaoSat.aggressionEff,
  );
  expect(
    'pickEffByProposalType policy = evolutionEff',
    pickEffByProposalType(zhangjiaoSat, 'policy') === zhangjiaoSat.evolutionEff,
  );

  // ─────────── 2) 调度器：等分 + 段内随机 ───────────
  const baseHour = new Date(2026, 4, 10, 14, 0, 0).getTime();
  // N=2: 段为 [0,30) [30,60)
  const slots2 = planSlotsForHour(2, baseHour, baseHour, () => 0.5);
  expect('N=2 slots 长度 = 2', slots2.length === 2);
  expect(
    'N=2 slot0 触发落在 [0,30) 分',
    slots2[0].triggerAtMs >= baseHour && slots2[0].triggerAtMs < baseHour + 30 * 60 * 1000,
  );
  expect(
    'N=2 slot1 触发落在 [30,60) 分',
    slots2[1].triggerAtMs >= baseHour + 30 * 60 * 1000 &&
      slots2[1].triggerAtMs < baseHour + 60 * 60 * 1000,
  );

  // N=3: 段为 [0,20) [20,40) [40,60)
  const slots3 = planSlotsForHour(3, baseHour, baseHour, () => 0.1);
  expect('N=3 slots 长度 = 3', slots3.length === 3);
  expect('N=3 slot0 落 [0,20)', slots3[0].triggerAtMs < baseHour + 20 * 60 * 1000);
  expect(
    'N=3 slot1 落 [20,40)',
    slots3[1].triggerAtMs >= baseHour + 20 * 60 * 1000 &&
      slots3[1].triggerAtMs < baseHour + 40 * 60 * 1000,
  );
  expect(
    'N=3 slot2 落 [40,60)',
    slots3[2].triggerAtMs >= baseHour + 40 * 60 * 1000 &&
      slots3[2].triggerAtMs < baseHour + 60 * 60 * 1000,
  );

  // 重启重掷：now=45 分（第 3 段中），slot0/slot1 已过 → 应只剩 slot2，
  // 且重掷区间为 [now=45, end=60) 而不再是整段 [40, 60)
  const now45 = baseHour + 45 * 60 * 1000;
  const reroll = planSlotsForHour(3, baseHour, now45, () => 0); // rng=0 → 取段起点
  expect('重启 now=45min: 只剩 slot2', reroll.length === 1 && reroll[0].slotIndex === 2);
  expect('重启 重掷起点 = max(now, segStart)', reroll[0].triggerAtMs === now45);

  // ─────────── 3) Scheduler 触发回调 ───────────
  const baseMs = new Date(2026, 4, 10, 15, 0, 0).getTime();
  let mockNow = baseMs;
  const fired = [];
  const fakeRng = (() => {
    const seq = [0.05, 0.55, 0.05, 0.55, 0.05, 0.55, 0.05, 0.55];
    let i = 0;
    return () => seq[i++ % seq.length];
  })();
  const sched = new AiKingHourlyScheduler({
    now: () => mockNow,
    rng: fakeRng,
    onFire: ({ factionId, slotIndex, triggerAtMs }) => {
      fired.push({ factionId, slotIndex, triggerAtMs });
    },
  });
  // tick 1: now = hour start。预生成各 king 的 slot 计划；rng=0.05 → slot 触发时刻接近段起点。
  await sched.runMinuteTick();
  // tick 2: 推进 35 分，应触发：N=2 灵帝 slot0；N=3 张角 slot0/slot1；N=2 刘备 slot0
  mockNow = baseMs + 35 * 60 * 1000;
  await sched.runMinuteTick();
  // tick 3: 推进 55 分，应再触发：剩余的 slot
  mockNow = baseMs + 55 * 60 * 1000;
  await sched.runMinuteTick();

  const lingdiFires = fired.filter((f) => f.factionId === 'san_1_faction_2001').length;
  const zhangjiaoFires = fired.filter((f) => f.factionId === 'san_1_faction_3001').length;
  const liubeiFires = fired.filter((f) => f.factionId === 'san_1_faction_1001').length;
  expect(`lingdi N=1 总触发 1 次`, lingdiFires === 1, { lingdiFires, fired });
  expect(`zhangjiao N=3 总触发 3 次`, zhangjiaoFires === 3, { zhangjiaoFires });
  expect(`liubei N=2 总触发 2 次`, liubeiFires === 2, { liubeiFires });

  // 二次 tick 同一 hour 内不重复 fire
  mockNow = baseMs + 56 * 60 * 1000;
  await sched.runMinuteTick();
  expect(
    '同小时内不重复触发',
    fired.length === lingdiFires + zhangjiaoFires + liubeiFires,
  );

  // ─────────── 4) 被动审批 + cityCount 启用 *_eff ───────────
  // 张角 ambition=0.9 → saturationCity=90；cityCount=95 进入饱和。
  // war=1, aggressionFactor=0.7 → aggressionEff=0.7
  const apvNoCC = passiveApprovalService.resolvePassiveApproval({
    factionId: 'san_1_faction_3001',
    proposalType: 'war',
    proposalId: 'smoke-no-cc',
    rng: () => 0.5, // dice=4(mult=1.0), u=0.5
  });
  expect('zhangjiao 不传 cityCount → base = aggression 原值 1', apvNoCC.base === 1);

  const apvSat = passiveApprovalService.resolvePassiveApproval({
    factionId: 'san_1_faction_3001',
    proposalType: 'war',
    proposalId: 'smoke-cc-95',
    cityCount: 95,
    rng: () => 0.5,
  });
  expect('zhangjiao cityCount=95（已饱和）→ base = aggressionEff 0.7', Math.abs(apvSat.base - 0.7) < 1e-9, apvSat);
  expect('zhangjiao cityCount=95 → audit.saturated === true', apvSat.saturated === true);

  // ─────────── 5) weightedPick 边界 ───────────
  expect('weightedPick 全 0 → null',
    aiKingActiveDecisionService.weightedPick(
      [{ key: 'a', weight: 0 }, { key: 'b', weight: 0 }],
      () => 0.5,
    ) === null,
  );
  expect('weightedPick 单边权重为正 → 必选该边',
    aiKingActiveDecisionService.weightedPick(
      [{ key: 'a', weight: 0 }, { key: 'b', weight: 1 }],
      () => 0.5,
    ) === 'b',
  );

  // ─────────── 6) 每日传书文案 + 主动决策内存留痕 ───────────
  const kingDailyLetterContentService = require('../services/kingDailyLetterContentService');
  const casual = kingDailyLetterContentService.pickCasualLine(
    'benevolent',
    '2026-07-14|smoke|p1|benevolent',
  );
  expect('闲聊池可取句', typeof casual === 'string' && casual.length > 0, { casual });

  const tag = kingDailyLetterContentService.classifySituationTag({
    warLoad: 1,
    cityCount: 5,
    supplyTier: 'B',
    aggressionEff: 0.5,
    evolutionEff: 0.5,
    saturated: false,
  });
  expect('在战 → at_war', tag === 'at_war');

  // 跑一次真库 dry-run 后立即取 recent，验证 record→get 链路（内部审计，非口谕 UI）
  await aiKingActiveDecisionService.decide({
    factionId: 'san_1_faction_1001',
    dryRun: true,
    rng: () => 0.5,
  });
  const recent = aiKingActiveDecisionService.getRecentDecision('san_1_faction_1001');
  expect('recent 存在且 factionId 匹配',
    !!recent && recent.factionId === 'san_1_faction_1001',
    { recent });
  expect('recent.king 含 characterId / courtesyName',
    !!recent && recent.king?.characterId === 'san_1_char_1001' && !!recent.king?.courtesyName,
    { king: recent?.king });

  // 过期窗口为负 → 必返回 null（验证 TTL 起作用；用 0 在同一 tick 内 delta=0 不会过期）
  const expired = aiKingActiveDecisionService.getRecentDecision('san_1_faction_1001', { withinMs: -1 });
  expect('TTL<0 → recent 视为过期返回 null', expired === null);

  // ─────────── 7) 政策 · 无条件利好审批抬升 ───────────
  const hanRecruitAssess = policyProposalAssessService.assessLongTermPolicyProposal(
    'san_1_faction_2001',
    factionPolicyDefaults.POLICY_CATEGORIES.RECRUIT,
    { enabled: true },
    null,
  );
  expect('汉室招贤 OFF→ON：零储备扣费', hanRecruitAssess.reserveCostSilver === 0);
  expect('汉室招贤 OFF→ON：势力利好 positive', hanRecruitAssess.factionBenefit === 'positive');

  const hanRecruitApv = passiveApprovalService.resolvePassiveApproval({
    factionId: 'san_1_faction_2001',
    proposalType: 'policy',
    proposalId: 'smoke-han-recruit',
    cityCount: 5,
    proposalContext: {
      assess: hanRecruitAssess,
      category: factionPolicyDefaults.POLICY_CATEGORIES.RECRUIT,
    },
    rng: () => 0.5,
  });
  expect('汉室免费招贤 → base ≥ 0.9', hanRecruitApv.base >= 0.9, hanRecruitApv);
  expect('汉室免费招贤 → boostedUnconditionalBenefit', hanRecruitApv.boostedUnconditionalBenefit === true);

  const rejectedDirtyRow = {
    config_json: { enabled: true },
    last_outcome: 'rejected',
    created_at: new Date('2026-06-07T12:55:30.000Z'),
    updated_at: new Date('2026-06-07T12:55:30.000Z'),
  };
  const hanRecruitRetryAssess = policyProposalAssessService.assessLongTermPolicyProposal(
    'san_1_faction_2001',
    factionPolicyDefaults.POLICY_CATEGORIES.RECRUIT,
    { enabled: true },
    rejectedDirtyRow,
  );
  expect(
    '首次驳回脏行后再谏言开启：仍判 OFF→ON 利好',
    hanRecruitRetryAssess.factionBenefit === 'positive',
    hanRecruitRetryAssess,
  );

  const siegeAssess = policyProposalAssessService.assessLongTermPolicyProposal(
    'san_1_faction_2001',
    factionPolicyDefaults.POLICY_CATEGORIES.SIEGE_REWARD,
    { personalSharePct: 70 },
    null,
  );
  expect('城战个人份额 80→70：势力利好 positive', siegeAssess.factionBenefit === 'positive');

  // ─────────── 总结 ───────────
  console.log(`\n=== smoke summary: pass=${pass} fail=${fail} ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('smoke crashed:', e);
  process.exit(2);
});
