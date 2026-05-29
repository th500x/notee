#!/usr/bin/env node
/**
 * 连接池并发 smoke（O3-D5 · T-16）
 *
 * 模拟 profile 读 / 道路短事务等热点，观察 limit=10 下排队与错误率。
 *
 * 用法（backend 目录或仓库根）：
 *   node backend/scripts/_dev_pool_load_smoke.cjs
 *   node backend/scripts/_dev_pool_load_smoke.cjs --concurrency 30 --hold-ms 50 --rounds 2
 *
 * 环境：与 `database/connection.js` 相同（`DB_*` · `DB_CONNECTION_LIMIT`）。
 */
const { pool, getPoolConfig, getPoolStats, closePool } = require('../database/connection');

function parseArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  const n = Number.parseInt(process.argv[idx + 1], 10);
  return Number.isFinite(n) ? n : fallback;
}

const concurrency = Math.max(1, parseArg('--concurrency', 25));
const holdMs = Math.max(0, parseArg('--hold-ms', 40));
const rounds = Math.max(1, parseArg('--rounds', 3));
const txRatio = Math.min(1, Math.max(0, parseArg('--tx-ratio', 0.35)));

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function workloadLight() {
  await pool.query('SELECT 1 AS ok');
}

async function workloadProfileSlice() {
  await pool.query(
    `SELECT player_id, food, silver, road_jun_id, road_position_x, road_position_y
       FROM players
      LIMIT 1`,
  );
}

/** 近似 `road/self`：短事务 + FOR UPDATE */
async function workloadRoadSelfTx() {
  const conn = await pool.getConnection();
  const started = Date.now();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT player_id, road_jun_id, road_position_x, road_position_y, road_client_notice
         FROM players
        LIMIT 1
        FOR UPDATE`,
    );
    if (rows.length && rows[0].road_client_notice) {
      await conn.query(`UPDATE players SET road_client_notice = NULL WHERE player_id = ?`, [
        rows[0].player_id,
      ]);
    }
    await new Promise((r) => setTimeout(r, holdMs));
    await conn.commit();
    return Date.now() - started;
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}

async function runWorker(workerId, roundIdx) {
  const useTx = Math.random() < txRatio;
  const t0 = Date.now();
  try {
    if (useTx) {
      await workloadRoadSelfTx();
    } else if (workerId % 3 === 0) {
      await workloadProfileSlice();
    } else {
      await workloadLight();
    }
    return { ok: true, ms: Date.now() - t0, tx: useTx };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, tx: useTx, error: e.message || String(e) };
  }
}

async function runRound(roundIdx) {
  let peakQueued = 0;
  const poll = setInterval(() => {
    const q = getPoolStats().queuedAcquires ?? 0;
    if (q > peakQueued) peakQueued = q;
  }, 5);

  const tasks = Array.from({ length: concurrency }, (_, i) => runWorker(i, roundIdx));
  const results = await Promise.all(tasks);
  clearInterval(poll);

  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  const latencies = ok.map((r) => r.ms).sort((a, b) => a - b);
  const stats = getPoolStats();

  return {
    round: roundIdx + 1,
    ok: ok.length,
    fail: fail.length,
    peakQueued,
    pool: stats,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    maxMs: latencies.length ? latencies[latencies.length - 1] : 0,
    errors: [...new Set(fail.map((r) => r.error))],
  };
}

async function main() {
  console.log('O3-D5 pool load smoke');
  console.log('config:', getPoolConfig());
  console.log(`scenario: concurrency=${concurrency}, holdMs=${holdMs}, rounds=${rounds}, txRatio=${txRatio}`);

  await pool.query('SELECT 1');

  const summaries = [];
  for (let r = 0; r < rounds; r += 1) {
    summaries.push(await runRound(r));
  }

  let ok = true;
  for (const s of summaries) {
    console.log(
      `round ${s.round}: ok=${s.ok} fail=${s.fail} p50=${s.p50}ms p95=${s.p95}ms max=${s.maxMs}ms peakQueue=${s.peakQueued} pool=${JSON.stringify(s.pool)}`,
    );
    if (s.fail > 0) {
      ok = false;
      console.error('  errors:', s.errors.join(' | '));
    }
  }

  const limit = getPoolConfig().connectionLimit;
  const worstQueue = Math.max(...summaries.map((s) => s.peakQueued));
  if (worstQueue > 0 && concurrency > limit) {
    console.log(
      `note: peak queue ${worstQueue} with concurrency ${concurrency} > limit ${limit} — expected; VPS 灰度前可按在线峰值调 DB_CONNECTION_LIMIT`,
    );
  }

  await closePool();
  console.log(ok ? '\nALL PASS' : '\nSOME FAILED');
  process.exit(ok ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await closePool();
  } catch (_) {}
  process.exit(1);
});
