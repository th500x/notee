#!/usr/bin/env node
/**
 * 手动触发真三日报 digest 生成（开发/补跑）
 *
 * 用法（在 33-san-storm/backend 目录）：
 *   node scripts/run-daily-report-digest.js
 *   node scripts/run-daily-report-digest.js --date 2026-06-06
 *   node scripts/run-daily-report-digest.js --force
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { runDailyDigestTick } = require('../services/dailyReportDigestService');

function parseArgs(argv) {
  const out = { force: false, date: null, serverId: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--force') out.force = true;
    else if (a === '--date' && argv[i + 1]) {
      out.date = argv[++i];
    } else if (a === '--server' && argv[i + 1]) {
      out.serverId = argv[++i];
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const result = await runDailyDigestTick({
    digestDateYmd: args.date,
    force: args.force,
    serverId: args.serverId,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
