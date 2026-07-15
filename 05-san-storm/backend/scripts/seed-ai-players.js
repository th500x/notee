/**
 * 播种 elite AI 玩家（幂等）。
 *
 * 用法（在 backend 目录执行）：
 *   node scripts/seed-ai-players.js                 # 白名单势力各补齐到默认人数（30）
 *   node scripts/seed-ai-players.js --per 10        # 每势力补齐到 10
 *   node scripts/seed-ai-players.js --server San_1_Chaos
 *   node scripts/seed-ai-players.js --prune         # 播种前先清理白名单外/孤儿 AI
 *
 * 复用 aiPlayerFillService（与未来后台/管理端入口同一逻辑），脚本只负责参数解析与汇报。
 * 可玩势力白名单见 config/aiPlayerBehavior.js（当前：刘备/汉室/黄巾）。
 * 设计文档：docs/01-jun-exploration/40-ai/42-2-AI_PLAYER_IMPLEMENTATION.md Step 1。
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { seedAiPlayers, pruneAiPlayersOutsideFactions } = require('../services/aiPlayerFillService');
const { pool } = require('../database/connection');

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--per' || arg === '--perFaction') {
      const n = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n > 0) opts.perFaction = n;
      i += 1;
    } else if (arg === '--server' || arg === '--serverId') {
      if (argv[i + 1]) opts.serverId = argv[i + 1];
      i += 1;
    } else if (arg === '--prune') {
      opts.prune = true;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log('[seed-ai-players] 开始播种 elite AI', opts);

  if (opts.prune) {
    const pruned = await pruneAiPlayersOutsideFactions({ serverId: opts.serverId });
    console.log(`[seed-ai-players] 清理白名单外/孤儿 AI：删除 ${pruned.deletedIds.length} 个（${pruned.deletedIds.join(', ') || '无'}）`);
  }

  const result = await seedAiPlayers(opts);

  console.log('\n[seed-ai-players] 结果汇总');
  console.log(`  服务器：${result.serverId}（current_season=${result.currentSeason}，配置赛季=${result.campaignSeason}）`);
  console.log(`  每势力目标人数：${result.perFaction}`);
  for (const f of result.factions) {
    console.log(`  - ${f.factionName}（${f.factionId}）：已有 ${f.existing}，新建 ${f.created}，合计 ${f.total}`);
  }
  console.log(`  本次新建合计：${result.totalCreated}`);
  console.log('[seed-ai-players] 完成');
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[seed-ai-players] 失败：', err);
    try { await pool.end(); } catch (_) { /* ignore */ }
    process.exit(1);
  });
