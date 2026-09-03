/**
 * 探索日清白名单与 config_events 对齐冒烟
 * node backend/services/playerExploreEventService.dailyReset.test.cjs
 */
const assert = require('assert');
const path = require('path');

// 从 backend 目录相对加载
process.chdir(path.join(__dirname, '..'));

const {
  EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET,
  maybeResetExploreEventChainsDaily,
} = require('./playerExploreEventService');
const { pool } = require('../database/connection');

async function main() {
  assert.ok(
    !EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET.includes('chain_cunfu_v1'),
    '不得再使用废弃 chain_cunfu_v1'
  );
  assert.ok(
    EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET.every((id) => id.startsWith('chain_wild_') || id.startsWith('chain_mini_')),
    '日清仅 wild/mini'
  );
  assert.ok(!EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET.includes('chain_tutorial_v1'));

  const ph = EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT chain_id, COUNT(*) AS n FROM config_events WHERE chain_id IN (${ph}) GROUP BY chain_id`,
    EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET
  );
  const found = new Set(rows.map((r) => r.chain_id));
  for (const id of EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET) {
    assert.ok(found.has(id), `config_events 缺少日清链 ${id}`);
  }
  const total = rows.reduce((s, r) => s + Number(r.n), 0);
  assert.ok(total > 0, '日清链应至少有一条 event');

  // 幂等：对不存在玩家调用不应抛
  await maybeResetExploreEventChainsDaily('__daily_reset_test_nonexistent__');

  console.log('playerExploreEventService.dailyReset.test.cjs: ok', {
    chains: EXPLORE_EVENT_CHAIN_IDS_DAILY_RESET.length,
    eventRows: total,
  });
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
