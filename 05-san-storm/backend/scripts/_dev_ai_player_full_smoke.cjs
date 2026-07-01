/* eslint-disable no-console */
/**
 * AI 玩家系统 · 集成验收烟测（42-2 Step 8）
 *
 * 用途：本地一键体检整条 AI 链，**不改动业务数据**（除可选的单人真实 routine 会按真人同一 service 正常落库）。
 *
 * 跑法（在 05-san-storm/backend 下）：
 *   node scripts/_dev_ai_player_full_smoke.cjs            # A+B+D（不实跑 routine，安全）
 *   node scripts/_dev_ai_player_full_smoke.cjs --run-one  # 额外 C：对 1 个 AI 实跑一轮 routine（会落库）
 *
 * 验收点：
 *   A. 90 人（按势力）已 seed、real/ai 账号隔离可见
 *   B. 一个 20 分钟窗口内：启动次数 == active AI 数；峰值并发 ≤ maxConcurrent（用真实 AI 列表 + stub routine）
 *   C.（可选）单人真实 routine 跑通（移动/攻城/抽卡/匪寨/探索/道路 PVP，全复用真人 service）
 *   D. 连接池配置/瞬时指标可见
 */

const { pool, getPoolConfig, getPoolStats } = require('../database/connection');
const { AI_PLAYER_BEHAVIOR, AI_PLAYER_SEED } = require('../config/aiPlayerBehavior');
const {
  AiPlayerBehaviorScheduler,
  defaultLoadAiPlayerIds,
  windowStartMs,
} = require('../services/aiPlayerBehaviorScheduler');

const RUN_ONE = process.argv.includes('--run-one');

function hr(title) {
  console.log('\n===== ' + title + ' =====');
}

async function partA_seedCheck() {
  hr('A · Seed 检查（按势力人数 + 账号隔离）');
  const [byFaction] = await pool.query(
    `SELECT p.faction_id, COUNT(*) AS n
       FROM players p INNER JOIN accounts a ON a.id = p.player_id
      WHERE a.account_type = 'ai'
      GROUP BY p.faction_id ORDER BY p.faction_id`,
  );
  console.log('AI 按势力:', JSON.stringify(byFaction));
  const [[acc]] = await pool.query(
    `SELECT
        SUM(account_type = 'ai') AS ai,
        SUM(account_type = 'real') AS real_cnt,
        SUM(account_type IS NULL) AS null_type
       FROM accounts`,
  );
  console.log('账号类型: ai=%s real=%s null=%s', acc.ai, acc.real_cnt, acc.null_type);

  const expectFactions = AI_PLAYER_SEED.factionIds || [];
  const per = AI_PLAYER_SEED.perFaction;
  const got = new Map(byFaction.map((r) => [String(r.faction_id), Number(r.n)]));
  let ok = true;
  for (const fid of expectFactions) {
    const n = got.get(String(fid)) || 0;
    const pass = n >= per;
    if (!pass) ok = false;
    console.log(`  ${fid}: ${n}/${per} ${pass ? 'OK' : '⚠ 不足（先跑 seed-ai-players.js）'}`);
  }
  const total = byFaction.reduce((s, r) => s + Number(r.n), 0);
  console.log(`AI 合计: ${total}（期望 ≈ ${per * expectFactions.length}）· 结论: ${ok ? 'PASS' : 'CHECK'}`);
  return { total, ok };
}

async function partB_schedulerWindow() {
  hr('B · 调度一窗（真实 AI 列表 + stub routine）');
  const windowMinutes = AI_PLAYER_BEHAVIOR.windowMinutes;
  const maxConcurrent = AI_PLAYER_BEHAVIOR.maxConcurrent;
  const baseMs = windowStartMs(Date.now(), windowMinutes);

  let curMs = baseMs;
  const resolvers = [];
  const firedOnce = new Map();
  let peakRunning = 0;
  let totalEnqueued = 0;

  const scheduler = new AiPlayerBehaviorScheduler({
    now: () => curMs,
    windowMinutes,
    maxConcurrent,
    loadAiPlayerIds: defaultLoadAiPlayerIds,
    runRoutine: (pid) => {
      firedOnce.set(pid, (firedOnce.get(pid) || 0) + 1);
      return new Promise((res) => resolvers.push(res));
    },
  });

  for (let m = 0; m < windowMinutes; m++) {
    curMs = baseMs + m * 60000 + 1000;
    // eslint-disable-next-line no-await-in-loop
    const r = await scheduler.runMinuteTick(curMs);
    totalEnqueued += r.enqueued;
    peakRunning = Math.max(peakRunning, r.running);
    // 排空本分钟启动的 stub（释放并发位 → drainQueue 续跑）
    // eslint-disable-next-line no-await-in-loop
    while (resolvers.length || scheduler.queue.length) {
      const done = resolvers.shift();
      if (done) done();
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  }

  const planSize = scheduler.plan.size;
  const startedCount = firedOnce.size;
  const everyoneOnce = [...firedOnce.values()].every((v) => v === 1);
  console.log(`窗口=${windowMinutes}min 并发上限=${maxConcurrent}`);
  console.log(`plan 人数=${planSize} 启动人数=${startedCount} 累计 enqueued=${totalEnqueued}`);
  console.log(`每人恰好一次=${everyoneOnce} 峰值并发=${peakRunning}（应 ≤ ${maxConcurrent}）`);
  const ok = planSize === startedCount && startedCount === totalEnqueued && everyoneOnce && peakRunning <= maxConcurrent;
  console.log(`结论: ${ok ? 'PASS' : 'FAIL'}`);
  return { ok, planSize, peakRunning };
}

async function partD_pool() {
  hr('D · 连接池');
  console.log('配置:', JSON.stringify(getPoolConfig()));
  console.log('瞬时:', JSON.stringify(getPoolStats()));
}

async function partC_runOne() {
  hr('C · 单人真实 routine（--run-one，会按真人 service 正常落库）');
  const orchestrator = require('../services/aiPlayerDailyOrchestrator');
  const [rows] = await pool.query(
    `SELECT p.player_id FROM players p INNER JOIN accounts a ON a.id = p.player_id
      WHERE a.account_type = 'ai' ORDER BY p.player_id LIMIT 1`,
  );
  const pid = rows[0]?.player_id;
  if (!pid) {
    console.log('无 AI 可跑');
    return;
  }
  console.log('pool before:', JSON.stringify(getPoolStats()));
  const res = await orchestrator.runAiPlayerRoutine(pid);
  console.log('pool after :', JSON.stringify(getPoolStats()));
  const s = res.steps || {};
  console.log(`player=${pid} ok=${res.ok}`);
  console.log(
    '  siege=%s gacha=%s bandit=%s explore=%s roadEnc(att/def)=%s/%s',
    JSON.stringify({ battles: s.siege?.battles, captured: s.siege?.captured, stop: s.siege?.stopReason }),
    JSON.stringify({ draws: s.gacha?.totalDraws, stop: s.gacha?.stopReason }),
    JSON.stringify({ battles: s.bandit?.battles, wins: s.bandit?.wins, stop: s.bandit?.stopReason }),
    JSON.stringify({ explored: s.explore?.explored, stop: s.explore?.stopReason }),
    JSON.stringify(s.warAttack?.roadEncounter || null),
    JSON.stringify(s.warDefend?.roadEncounter || null),
  );
}

async function main() {
  console.log('AI 玩家集成验收烟测 · behaviorEnabled(运行时开关)=%s', AI_PLAYER_BEHAVIOR.behaviorEnabled);
  const a = await partA_seedCheck();
  const b = await partB_schedulerWindow();
  if (RUN_ONE) await partC_runOne();
  await partD_pool();

  hr('结论');
  console.log(`A seed: ${a.ok ? 'PASS' : 'CHECK'} · B scheduler: ${b.ok ? 'PASS' : 'FAIL'}${RUN_ONE ? ' · C routine: 见上' : ' · C: 跳过(--run-one 开启)'}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('烟测异常:', e);
  process.exit(1);
});
